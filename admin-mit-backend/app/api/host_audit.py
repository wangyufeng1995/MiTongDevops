"""
主机审计日志和命令过滤配置 API

提供审计日志查询、清理、统计功能，以及命令过滤规则的配置管理。
Feature: webshell-command-audit
Requirements: 4.1, 5.1, 7.1, 7.5, 6.3

权限说明:
- host:audit - 查看审计日志权限
- host:audit:config - 配置命令过滤规则权限
"""
from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone
from functools import wraps
from app.core.middleware import tenant_required, role_required, permission_required
from app.services.webshell_audit_service import WebShellAuditService
from app.services.command_filter_service import CommandFilterService
from app.models.host import SSHHost
from app.models.webshell_audit import DEFAULT_BLACKLIST
import logging

logger = logging.getLogger(__name__)

host_audit_bp = Blueprint('host_audit', __name__)

# 服务实例
audit_service = WebShellAuditService()
filter_service = CommandFilterService()


def audit_permission_required(f):
    """
    审计日志查看权限装饰器
    
    检查用户是否有 host:audit 权限或管理员角色
    Requirements: 6.3
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 检查是否有管理员角色
        admin_roles = ['admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员']
        if any(role in g.user_roles for role in admin_roles):
            return f(*args, **kwargs)
        
        # 检查是否有 host:audit 权限
        from app.services.auth_service import auth_service
        if auth_service.validate_user_permissions(['host:audit']):
            return f(*args, **kwargs)
        
        logger.warning(f"Permission denied: user {g.user_id} lacks host:audit permission")
        return jsonify({
            'success': False,
            'message': '权限不足，需要 host:audit 权限',
            'error_code': 'FORBIDDEN'
        }), 403
    
    return decorated_function


def audit_config_permission_required(f):
    """
    审计配置管理权限装饰器
    
    检查用户是否有 host:audit:config 权限或管理员角色
    Requirements: 6.3
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # 检查是否有管理员角色
        admin_roles = ['admin', 'super_admin', '超级管理员', '系统管理员']
        if any(role in g.user_roles for role in admin_roles):
            return f(*args, **kwargs)
        
        # 检查是否有 host:audit:config 权限
        from app.services.auth_service import auth_service
        if auth_service.validate_user_permissions(['host:audit:config']):
            return f(*args, **kwargs)
        
        logger.warning(f"Permission denied: user {g.user_id} lacks host:audit:config permission")
        return jsonify({
            'success': False,
            'message': '权限不足，需要 host:audit:config 权限',
            'error_code': 'FORBIDDEN'
        }), 403
    
    return decorated_function


# ============== 审计日志 API ==============

@host_audit_bp.route('/hosts/<int:host_id>/audit-logs', methods=['GET'])
@tenant_required
@audit_permission_required
def get_audit_logs(host_id):
    """
    获取主机审计日志列表
    
    Query params:
        - user_id: 用户ID过滤
        - status: 状态过滤 ('success', 'blocked', 'failed')
        - start_date: 开始日期 (ISO格式)
        - end_date: 结束日期 (ISO格式)
        - page: 页码 (默认1)
        - page_size: 每页数量 (默认50, 最大100)
    
    Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
    """
    try:
        # 验证主机存在且属于当前租户
        host = SSHHost.query.filter_by(
            id=host_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not host:
            return jsonify({
                'success': False,
                'message': '主机不存在'
            }), 404
        
        # 获取查询参数
        user_id = request.args.get('user_id', type=int)
        status = request.args.get('status')
        start_date_str = request.args.get('start_date')
        end_date_str = request.args.get('end_date')
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 50, type=int)
        
        # 限制每页最大数量
        page_size = min(page_size, 100)
        
        # 解析日期
        start_date = None
        end_date = None
        
        if start_date_str:
            try:
                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '无效的开始日期格式'
                }), 400
        
        if end_date_str:
            try:
                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '无效的结束日期格式'
                }), 400
        
        # 验证状态值
        if status and status not in ('success', 'blocked', 'failed'):
            return jsonify({
                'success': False,
                'message': '无效的状态值，必须是 success, blocked 或 failed'
            }), 400
        
        # 查询审计日志
        logs, total = audit_service.query_logs(
            host_id=host_id,
            tenant_id=g.tenant_id,
            user_id=user_id,
            status=status,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size
        )
        
        return jsonify({
            'success': True,
            'data': {
                'logs': [log.to_dict() for log in logs],
                'pagination': {
                    'page': page,
                    'page_size': page_size,
                    'total': total,
                    'pages': (total + page_size - 1) // page_size
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Get audit logs error: {e}")
        return jsonify({
            'success': False,
            'message': '获取审计日志失败'
        }), 500


@host_audit_bp.route('/hosts/<int:host_id>/audit-logs/clear', methods=['POST'])
@tenant_required
@audit_config_permission_required
def clear_audit_logs(host_id):
    """
    清理主机审计日志
    
    Body:
        - days_to_keep: 保留最近N天的日志 (0表示清理所有)
    
    Requirements: 5.1, 5.2, 5.3, 5.4
    """
    try:
        # 验证主机存在且属于当前租户
        host = SSHHost.query.filter_by(
            id=host_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not host:
            return jsonify({
                'success': False,
                'message': '主机不存在'
            }), 404
        
        data = request.get_json() or {}
        days_to_keep = data.get('days_to_keep', 0)
        
        # 验证参数
        if not isinstance(days_to_keep, int) or days_to_keep < 0:
            return jsonify({
                'success': False,
                'message': 'days_to_keep 必须是非负整数'
            }), 400
        
        # 清理日志
        deleted_count = audit_service.clear_logs(
            host_id=host_id,
            days_to_keep=days_to_keep,
            tenant_id=g.tenant_id,
            operator_user_id=g.user_id
        )
        
        message = f'已清理 {deleted_count} 条审计日志'
        if days_to_keep > 0:
            message += f'，保留最近 {days_to_keep} 天的日志'
        
        return jsonify({
            'success': True,
            'data': {
                'deleted_count': deleted_count
            },
            'message': message
        })
        
    except Exception as e:
        logger.error(f"Clear audit logs error: {e}")
        return jsonify({
            'success': False,
            'message': '清理审计日志失败'
        }), 500


@host_audit_bp.route('/hosts/<int:host_id>/audit-logs/stats', methods=['GET'])
@tenant_required
@audit_permission_required
def get_audit_stats(host_id):
    """
    获取主机审计日志统计信息
    
    Query params:
        - days: 统计天数 (默认30)
    
    Requirements: 4.1
    """
    try:
        # 验证主机存在且属于当前租户
        host = SSHHost.query.filter_by(
            id=host_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not host:
            return jsonify({
                'success': False,
                'message': '主机不存在'
            }), 404
        
        days = request.args.get('days', 30, type=int)
        days = min(max(days, 1), 365)  # 限制在1-365天
        
        stats = audit_service.get_stats(
            host_id=host_id,
            tenant_id=g.tenant_id,
            days=days
        )
        
        return jsonify({
            'success': True,
            'data': stats
        })
        
    except Exception as e:
        logger.error(f"Get audit stats error: {e}")
        return jsonify({
            'success': False,
            'message': '获取审计统计失败'
        }), 500


# ============== 命令过滤配置 API ==============

@host_audit_bp.route('/hosts/<int:host_id>/command-filter', methods=['GET'])
@tenant_required
@audit_permission_required
def get_host_filter_rules(host_id):
    """
    获取主机命令过滤规则
    
    如果主机没有特定规则，返回全局规则
    
    Requirements: 7.1, 7.2, 7.3, 7.4
    """
    try:
        # 验证主机存在且属于当前租户
        host = SSHHost.query.filter_by(
            id=host_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not host:
            return jsonify({
                'success': False,
                'message': '主机不存在'
            }), 404
        
        # 获取规则
        rules = filter_service.get_filter_rules(host_id, g.tenant_id)
        
        if rules:
            is_global = rules.host_id is None
            return jsonify({
                'success': True,
                'data': {
                    'rules': rules.to_dict(),
                    'is_global': is_global,
                    'has_host_rules': not is_global
                }
            })
        else:
            # 没有规则，返回默认配置
            return jsonify({
                'success': True,
                'data': {
                    'rules': {
                        'mode': 'blacklist',
                        'whitelist': [],
                        'blacklist': DEFAULT_BLACKLIST,
                        'is_active': False
                    },
                    'is_global': True,
                    'has_host_rules': False
                }
            })
        
    except Exception as e:
        logger.error(f"Get host filter rules error: {e}")
        return jsonify({
            'success': False,
            'message': '获取命令过滤规则失败'
        }), 500


@host_audit_bp.route('/hosts/<int:host_id>/command-filter', methods=['PUT'])
@tenant_required
@audit_config_permission_required
def set_host_filter_rules(host_id):
    """
    设置主机命令过滤规则
    
    Body:
        - mode: 模式 ('whitelist' 或 'blacklist')
        - whitelist: 白名单命令列表
        - blacklist: 黑名单命令列表
    
    Requirements: 7.1, 7.2, 7.5, 7.6
    """
    try:
        # 验证主机存在且属于当前租户
        host = SSHHost.query.filter_by(
            id=host_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not host:
            return jsonify({
                'success': False,
                'message': '主机不存在'
            }), 404
        
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求体不能为空'
            }), 400
        
        mode = data.get('mode', 'blacklist')
        whitelist = data.get('whitelist', [])
        blacklist = data.get('blacklist', [])
        
        # 验证模式
        if mode not in ('whitelist', 'blacklist'):
            return jsonify({
                'success': False,
                'message': '无效的模式，必须是 whitelist 或 blacklist'
            }), 400
        
        # 验证列表格式
        if not isinstance(whitelist, list) or not isinstance(blacklist, list):
            return jsonify({
                'success': False,
                'message': 'whitelist 和 blacklist 必须是数组'
            }), 400
        
        # 验证列表内容
        for item in whitelist + blacklist:
            if not isinstance(item, str) or not item.strip():
                return jsonify({
                    'success': False,
                    'message': '命令列表中的每个项目必须是非空字符串'
                }), 400
        
        # 设置规则
        success, message, rule = filter_service.set_host_rules(
            host_id=host_id,
            tenant_id=g.tenant_id,
            mode=mode,
            whitelist=[item.strip() for item in whitelist],
            blacklist=[item.strip() for item in blacklist]
        )
        
        if success:
            return jsonify({
                'success': True,
                'data': {
                    'rules': rule.to_dict() if rule else None
                },
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
    except Exception as e:
        logger.error(f"Set host filter rules error: {e}")
        return jsonify({
            'success': False,
            'message': '设置命令过滤规则失败'
        }), 500


@host_audit_bp.route('/hosts/<int:host_id>/command-filter', methods=['DELETE'])
@tenant_required
@audit_config_permission_required
def delete_host_filter_rules(host_id):
    """
    删除主机命令过滤规则（回退到全局规则）
    
    Requirements: 7.1, 7.4
    """
    try:
        # 验证主机存在且属于当前租户
        host = SSHHost.query.filter_by(
            id=host_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not host:
            return jsonify({
                'success': False,
                'message': '主机不存在'
            }), 404
        
        # 删除规则
        success, message = filter_service.delete_host_rules(
            host_id=host_id,
            tenant_id=g.tenant_id
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
    except Exception as e:
        logger.error(f"Delete host filter rules error: {e}")
        return jsonify({
            'success': False,
            'message': '删除命令过滤规则失败'
        }), 500


# ============== 全局命令过滤配置 API ==============

@host_audit_bp.route('/command-filter/global', methods=['GET'])
@tenant_required
@audit_permission_required
def get_global_filter_rules():
    """
    获取全局命令过滤规则
    
    Requirements: 7.1, 7.3
    """
    try:
        # 获取全局规则
        rules = filter_service.get_filter_rules(None, g.tenant_id)
        
        if rules:
            return jsonify({
                'success': True,
                'data': {
                    'rules': rules.to_dict()
                }
            })
        else:
            # 没有规则，返回默认配置
            return jsonify({
                'success': True,
                'data': {
                    'rules': {
                        'mode': 'blacklist',
                        'whitelist': [],
                        'blacklist': DEFAULT_BLACKLIST,
                        'is_active': False
                    }
                }
            })
        
    except Exception as e:
        logger.error(f"Get global filter rules error: {e}")
        return jsonify({
            'success': False,
            'message': '获取全局命令过滤规则失败'
        }), 500


@host_audit_bp.route('/command-filter/global', methods=['PUT'])
@tenant_required
@audit_config_permission_required
def set_global_filter_rules():
    """
    设置全局命令过滤规则
    
    Body:
        - mode: 模式 ('whitelist' 或 'blacklist')
        - whitelist: 白名单命令列表
        - blacklist: 黑名单命令列表
    
    Requirements: 7.1, 7.3, 7.5, 7.6
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求体不能为空'
            }), 400
        
        mode = data.get('mode', 'blacklist')
        whitelist = data.get('whitelist', [])
        blacklist = data.get('blacklist', [])
        
        # 验证模式
        if mode not in ('whitelist', 'blacklist'):
            return jsonify({
                'success': False,
                'message': '无效的模式，必须是 whitelist 或 blacklist'
            }), 400
        
        # 验证列表格式
        if not isinstance(whitelist, list) or not isinstance(blacklist, list):
            return jsonify({
                'success': False,
                'message': 'whitelist 和 blacklist 必须是数组'
            }), 400
        
        # 验证列表内容
        for item in whitelist + blacklist:
            if not isinstance(item, str) or not item.strip():
                return jsonify({
                    'success': False,
                    'message': '命令列表中的每个项目必须是非空字符串'
                }), 400
        
        # 设置规则
        success, message, rule = filter_service.set_global_rules(
            tenant_id=g.tenant_id,
            mode=mode,
            whitelist=[item.strip() for item in whitelist],
            blacklist=[item.strip() for item in blacklist]
        )
        
        if success:
            return jsonify({
                'success': True,
                'data': {
                    'rules': rule.to_dict() if rule else None
                },
                'message': message
            })
        else:
            return jsonify({
                'success': False,
                'message': message
            }), 400
        
    except Exception as e:
        logger.error(f"Set global filter rules error: {e}")
        return jsonify({
            'success': False,
            'message': '设置全局命令过滤规则失败'
        }), 500


@host_audit_bp.route('/command-filter/default-blacklist', methods=['GET'])
@tenant_required
def get_default_blacklist():
    """
    获取默认黑名单命令列表
    
    用于前端显示参考
    """
    try:
        return jsonify({
            'success': True,
            'data': {
                'blacklist': filter_service.get_default_blacklist()
            }
        })
        
    except Exception as e:
        logger.error(f"Get default blacklist error: {e}")
        return jsonify({
            'success': False,
            'message': '获取默认黑名单失败'
        }), 500

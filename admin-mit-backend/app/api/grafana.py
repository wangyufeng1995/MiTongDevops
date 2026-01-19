"""
Grafana 管理 API

提供 Grafana 配置管理和仪表盘管理 API。
注意：所有 API 只使用 GET 和 POST 方法，不使用 PUT/DELETE。

Requirements: 4.1-4.7
"""
from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, role_required
from app.services.operation_log_service import operation_log_service
from app.models.grafana import GrafanaConfig, GrafanaDashboard
from app.extensions import db
import logging

logger = logging.getLogger(__name__)
grafana_bp = Blueprint('grafana', __name__)


def log_grafana_operation(action, resource, resource_id=None, details=None):
    """记录 Grafana 操作日志的辅助函数"""
    try:
        operation_log_service.log_operation(
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details
        )
    except Exception as e:
        logger.warning(f"Failed to log grafana operation: {e}")


# ==================== Grafana 配置管理 API ====================

@grafana_bp.route('/configs', methods=['GET'])
@tenant_required
def list_configs():
    """
    获取 Grafana 配置列表
    
    Query Parameters:
        - page: 页码 (默认 1)
        - per_page: 每页数量 (默认 50)
        - search: 搜索关键词
        - status: 状态过滤 (0-禁用, 1-启用)
    
    Returns:
        JSON: 配置列表和分页信息
        
    Requirements: 4.1
    """
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        search = request.args.get('search', '')
        status = request.args.get('status', type=int)
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        # 构建查询
        query = GrafanaConfig.query.filter_by(tenant_id=g.tenant_id)
        
        # 搜索过滤
        if search:
            query = query.filter(
                db.or_(
                    GrafanaConfig.name.ilike(f'%{search}%'),
                    GrafanaConfig.url.ilike(f'%{search}%')
                )
            )
        
        # 状态过滤
        if status is not None:
            query = query.filter_by(status=status)
        
        # 排序：按创建时间倒序
        query = query.order_by(GrafanaConfig.created_at.desc())
        
        # 分页
        pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # 使用 to_dict() 返回完整数据，包含仪表盘列表
        configs = [config.to_dict() for config in pagination.items]
        
        return jsonify({
            'success': True,
            'data': {
                'configs': configs,
                'pagination': {
                    'page': pagination.page,
                    'per_page': pagination.per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            }
        })
        
    except Exception as e:
        logger.error(f"List grafana configs error: {e}")
        return jsonify({
            'success': False,
            'message': '获取 Grafana 配置列表失败'
        }), 500


@grafana_bp.route('/configs/<int:config_id>', methods=['GET'])
@tenant_required
def get_config(config_id):
    """
    获取单个 Grafana 配置
    
    Args:
        config_id: 配置 ID
    
    Returns:
        JSON: 配置详情（包含仪表盘列表）
        
    Requirements: 4.1
    """
    try:
        config = GrafanaConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': 'Grafana 配置不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'config': config.to_dict()
            }
        })
        
    except Exception as e:
        logger.error(f"Get grafana config error: {e}")
        return jsonify({
            'success': False,
            'message': '获取 Grafana 配置失败'
        }), 500


@grafana_bp.route('/configs', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def create_config():
    """
    创建 Grafana 配置
    
    Request Body:
        - name: 配置名称 (必需)
        - url: Grafana 服务器 URL (必需)
        - status: 状态 (0-禁用, 1-启用, 默认 1)
        - iframe_height: iframe 高度 (默认 800)
        - auth_type: 认证类型 (none, basic, token, api_key)
        - auth_username: 用户名
        - auth_password: 密码
        - auth_token: Bearer Token
        - api_key: API Key
        - use_proxy: 是否使用代理
        - allow_anonymous: 是否允许匿名访问
    
    Returns:
        JSON: 创建的配置
        
    Requirements: 4.1
    """
    try:
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('name'):
            return jsonify({
                'success': False,
                'message': '配置名称不能为空'
            }), 400
        
        if not data.get('url'):
            return jsonify({
                'success': False,
                'message': 'Grafana 服务器 URL 不能为空'
            }), 400
        
        # 检查名称是否已存在
        existing = GrafanaConfig.query.filter_by(
            tenant_id=g.tenant_id,
            name=data['name']
        ).first()
        
        if existing:
            return jsonify({
                'success': False,
                'message': '配置名称已存在'
            }), 400
        
        # 创建配置
        config = GrafanaConfig(
            tenant_id=g.tenant_id,
            name=data['name'],
            url=data['url'],
            status=data.get('status', 1),
            iframe_height=data.get('iframe_height', 800),
            # 认证配置
            auth_type=data.get('auth_type', 'none'),
            auth_username=data.get('auth_username'),
            auth_password=data.get('auth_password'),
            auth_token=data.get('auth_token'),
            api_key=data.get('api_key'),
            use_proxy=data.get('use_proxy', True),
            allow_anonymous=data.get('allow_anonymous', False),
            created_by=g.user_id
        )
        
        # 验证配置
        is_valid, error_msg = config.validate_config()
        if not is_valid:
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        db.session.add(config)
        db.session.commit()
        
        # 记录操作日志
        log_grafana_operation(
            action='create',
            resource='grafana_config',
            resource_id=config.id,
            details={'name': config.name, 'url': config.url}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'config': config.to_dict()
            },
            'message': 'Grafana 配置创建成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Create grafana config error: {e}")
        return jsonify({
            'success': False,
            'message': '创建 Grafana 配置失败'
        }), 500


@grafana_bp.route('/configs/<int:config_id>', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def update_config(config_id):
    """
    更新 Grafana 配置
    
    Args:
        config_id: 配置 ID
    
    Request Body:
        - name: 配置名称
        - url: Grafana 服务器 URL
        - status: 状态
        - iframe_height: iframe 高度
        - auth_type: 认证类型
        - auth_username: 用户名
        - auth_password: 密码
        - auth_token: Bearer Token
        - api_key: API Key
        - use_proxy: 是否使用代理
        - allow_anonymous: 是否允许匿名访问
    
    Returns:
        JSON: 更新后的配置
        
    Requirements: 4.4
    """
    try:
        config = GrafanaConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': 'Grafana 配置不存在'
            }), 404
        
        data = request.get_json()
        
        # 检查名称是否与其他配置冲突
        if 'name' in data and data['name'] != config.name:
            existing = GrafanaConfig.query.filter_by(
                tenant_id=g.tenant_id,
                name=data['name']
            ).first()
            if existing:
                return jsonify({
                    'success': False,
                    'message': '配置名称已存在'
                }), 400
            config.name = data['name']
        
        # 更新基本字段
        if 'url' in data:
            config.url = data['url']
        if 'status' in data:
            config.status = data['status']
        if 'iframe_height' in data:
            config.iframe_height = data['iframe_height']
        
        # 更新认证配置
        if 'auth_type' in data:
            config.auth_type = data['auth_type']
        if 'auth_username' in data:
            config.auth_username = data['auth_username']
        # 只在提供了新密码时才更新
        if data.get('auth_password'):
            config.auth_password = data['auth_password']
        if data.get('auth_token'):
            config.auth_token = data['auth_token']
        if data.get('api_key'):
            config.api_key = data['api_key']
        
        # 更新代理配置
        if 'use_proxy' in data:
            config.use_proxy = data['use_proxy']
        if 'allow_anonymous' in data:
            config.allow_anonymous = data['allow_anonymous']
        
        # 验证配置
        is_valid, error_msg = config.validate_config()
        if not is_valid:
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        db.session.commit()
        
        # 记录操作日志
        log_grafana_operation(
            action='update',
            resource='grafana_config',
            resource_id=config.id,
            details={'name': config.name, 'url': config.url}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'config': config.to_dict()
            },
            'message': 'Grafana 配置更新成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Update grafana config error: {e}")
        return jsonify({
            'success': False,
            'message': '更新 Grafana 配置失败'
        }), 500


@grafana_bp.route('/configs/<int:config_id>/delete', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_config(config_id):
    """
    删除 Grafana 配置
    
    Args:
        config_id: 配置 ID
    
    Returns:
        JSON: 删除结果
        
    Requirements: 4.5
    """
    try:
        config = GrafanaConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': 'Grafana 配置不存在'
            }), 404
        
        config_name = config.name
        config_url = config.url
        
        # 删除配置（级联删除关联的仪表盘）
        db.session.delete(config)
        db.session.commit()
        
        # 记录操作日志
        log_grafana_operation(
            action='delete',
            resource='grafana_config',
            resource_id=config_id,
            details={'name': config_name, 'url': config_url}
        )
        
        return jsonify({
            'success': True,
            'message': 'Grafana 配置删除成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Delete grafana config error: {e}")
        return jsonify({
            'success': False,
            'message': '删除 Grafana 配置失败'
        }), 500



# ==================== Grafana 仪表盘管理 API ====================

@grafana_bp.route('/configs/<int:config_id>/dashboards', methods=['GET'])
@tenant_required
def list_dashboards(config_id):
    """
    获取 Grafana 配置下的仪表盘列表
    
    Args:
        config_id: 配置 ID
    
    Returns:
        JSON: 仪表盘列表
        
    Requirements: 4.2
    """
    try:
        config = GrafanaConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': 'Grafana 配置不存在'
            }), 404
        
        dashboards = config.dashboards.order_by(GrafanaDashboard.sort_order).all()
        
        return jsonify({
            'success': True,
            'data': {
                'dashboards': [d.to_dict() for d in dashboards],
                'config_name': config.name
            }
        })
        
    except Exception as e:
        logger.error(f"List grafana dashboards error: {e}")
        return jsonify({
            'success': False,
            'message': '获取仪表盘列表失败'
        }), 500


@grafana_bp.route('/configs/<int:config_id>/dashboards', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def create_dashboard(config_id):
    """
    添加仪表盘到 Grafana 配置
    
    Args:
        config_id: 配置 ID
    
    Request Body:
        - name: 仪表盘名称 (必需)
        - url: 仪表盘 URL (必需)
        - description: 仪表盘描述 (可选)
        - is_default: 是否设为默认 (默认 false)
        - sort_order: 排序顺序 (默认 0)
    
    Returns:
        JSON: 创建的仪表盘
        
    Requirements: 4.2
    """
    try:
        config = GrafanaConfig.query.filter_by(
            id=config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': 'Grafana 配置不存在'
            }), 404
        
        data = request.get_json()
        
        # 验证必需字段
        if not data.get('name'):
            return jsonify({
                'success': False,
                'message': '仪表盘名称不能为空'
            }), 400
        
        if not data.get('url'):
            return jsonify({
                'success': False,
                'message': '仪表盘 URL 不能为空'
            }), 400
        
        # 检查名称是否已存在
        existing = GrafanaDashboard.query.filter_by(
            config_id=config_id,
            name=data['name']
        ).first()
        
        if existing:
            return jsonify({
                'success': False,
                'message': '该配置下已存在同名仪表盘'
            }), 400
        
        # 创建仪表盘
        dashboard = GrafanaDashboard(
            config_id=config_id,
            name=data['name'],
            url=data['url'],
            description=data.get('description', ''),
            is_default=data.get('is_default', False),
            sort_order=data.get('sort_order', 0)
        )
        
        # 验证仪表盘
        is_valid, error_msg = dashboard.validate_dashboard()
        if not is_valid:
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        # 如果设为默认，取消其他默认仪表盘
        if dashboard.is_default:
            GrafanaDashboard.query.filter_by(
                config_id=config_id,
                is_default=True
            ).update({'is_default': False})
        
        db.session.add(dashboard)
        db.session.commit()
        
        # 记录操作日志
        log_grafana_operation(
            action='create',
            resource='grafana_dashboard',
            resource_id=dashboard.id,
            details={'name': dashboard.name, 'url': dashboard.url, 'config_name': config.name}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'dashboard': dashboard.to_dict()
            },
            'message': '仪表盘添加成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Create grafana dashboard error: {e}")
        return jsonify({
            'success': False,
            'message': '添加仪表盘失败'
        }), 500


@grafana_bp.route('/dashboards/<int:dashboard_id>', methods=['GET'])
@tenant_required
def get_dashboard(dashboard_id):
    """
    获取单个仪表盘详情
    
    Args:
        dashboard_id: 仪表盘 ID
    
    Returns:
        JSON: 仪表盘详情
        
    Requirements: 4.2
    """
    try:
        dashboard = GrafanaDashboard.query.filter_by(id=dashboard_id).first()
        
        if not dashboard:
            return jsonify({
                'success': False,
                'message': '仪表盘不存在'
            }), 404
        
        # 验证租户权限
        config = GrafanaConfig.query.filter_by(
            id=dashboard.config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '仪表盘不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'dashboard': dashboard.to_dict()
            }
        })
        
    except Exception as e:
        logger.error(f"Get grafana dashboard error: {e}")
        return jsonify({
            'success': False,
            'message': '获取仪表盘失败'
        }), 500


@grafana_bp.route('/dashboards/<int:dashboard_id>', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def update_dashboard(dashboard_id):
    """
    更新仪表盘
    
    Args:
        dashboard_id: 仪表盘 ID
    
    Request Body:
        - name: 仪表盘名称
        - url: 仪表盘 URL
        - description: 仪表盘描述
        - is_default: 是否设为默认
        - sort_order: 排序顺序
    
    Returns:
        JSON: 更新后的仪表盘
        
    Requirements: 4.3
    """
    try:
        dashboard = GrafanaDashboard.query.filter_by(id=dashboard_id).first()
        
        if not dashboard:
            return jsonify({
                'success': False,
                'message': '仪表盘不存在'
            }), 404
        
        # 验证租户权限
        config = GrafanaConfig.query.filter_by(
            id=dashboard.config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '仪表盘不存在'
            }), 404
        
        data = request.get_json()
        
        # 检查名称是否与其他仪表盘冲突
        if 'name' in data and data['name'] != dashboard.name:
            existing = GrafanaDashboard.query.filter_by(
                config_id=dashboard.config_id,
                name=data['name']
            ).first()
            if existing:
                return jsonify({
                    'success': False,
                    'message': '该配置下已存在同名仪表盘'
                }), 400
            dashboard.name = data['name']
        
        # 更新字段
        if 'url' in data:
            dashboard.url = data['url']
        if 'description' in data:
            dashboard.description = data['description']
        if 'sort_order' in data:
            dashboard.sort_order = data['sort_order']
        
        # 处理默认仪表盘
        if 'is_default' in data:
            if data['is_default'] and not dashboard.is_default:
                # 取消其他默认仪表盘
                GrafanaDashboard.query.filter(
                    GrafanaDashboard.config_id == dashboard.config_id,
                    GrafanaDashboard.id != dashboard_id,
                    GrafanaDashboard.is_default == True
                ).update({'is_default': False})
            dashboard.is_default = data['is_default']
        
        # 验证仪表盘
        is_valid, error_msg = dashboard.validate_dashboard()
        if not is_valid:
            return jsonify({
                'success': False,
                'message': error_msg
            }), 400
        
        db.session.commit()
        
        # 记录操作日志
        log_grafana_operation(
            action='update',
            resource='grafana_dashboard',
            resource_id=dashboard.id,
            details={'name': dashboard.name, 'url': dashboard.url}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'dashboard': dashboard.to_dict()
            },
            'message': '仪表盘更新成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Update grafana dashboard error: {e}")
        return jsonify({
            'success': False,
            'message': '更新仪表盘失败'
        }), 500


@grafana_bp.route('/dashboards/<int:dashboard_id>/delete', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_dashboard(dashboard_id):
    """
    删除仪表盘
    
    Args:
        dashboard_id: 仪表盘 ID
    
    Returns:
        JSON: 删除结果
        
    Requirements: 4.3
    """
    try:
        dashboard = GrafanaDashboard.query.filter_by(id=dashboard_id).first()
        
        if not dashboard:
            return jsonify({
                'success': False,
                'message': '仪表盘不存在'
            }), 404
        
        # 验证租户权限
        config = GrafanaConfig.query.filter_by(
            id=dashboard.config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '仪表盘不存在'
            }), 404
        
        dashboard_name = dashboard.name
        dashboard_url = dashboard.url
        config_name = config.name
        
        # 删除仪表盘
        db.session.delete(dashboard)
        db.session.commit()
        
        # 记录操作日志
        log_grafana_operation(
            action='delete',
            resource='grafana_dashboard',
            resource_id=dashboard_id,
            details={'name': dashboard_name, 'url': dashboard_url, 'config_name': config_name}
        )
        
        return jsonify({
            'success': True,
            'message': '仪表盘删除成功'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Delete grafana dashboard error: {e}")
        return jsonify({
            'success': False,
            'message': '删除仪表盘失败'
        }), 500


@grafana_bp.route('/dashboards/<int:dashboard_id>/default', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def set_default_dashboard(dashboard_id):
    """
    设置默认仪表盘
    
    Args:
        dashboard_id: 仪表盘 ID
    
    Returns:
        JSON: 设置结果
        
    Requirements: 4.7
    """
    try:
        dashboard = GrafanaDashboard.query.filter_by(id=dashboard_id).first()
        
        if not dashboard:
            return jsonify({
                'success': False,
                'message': '仪表盘不存在'
            }), 404
        
        # 验证租户权限
        config = GrafanaConfig.query.filter_by(
            id=dashboard.config_id,
            tenant_id=g.tenant_id
        ).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': '仪表盘不存在'
            }), 404
        
        # 取消其他默认仪表盘
        GrafanaDashboard.query.filter(
            GrafanaDashboard.config_id == dashboard.config_id,
            GrafanaDashboard.id != dashboard_id
        ).update({'is_default': False})
        
        # 设置当前仪表盘为默认
        dashboard.is_default = True
        db.session.commit()
        
        # 记录操作日志
        log_grafana_operation(
            action='set_default',
            resource='grafana_dashboard',
            resource_id=dashboard.id,
            details={'name': dashboard.name, 'config_name': config.name}
        )
        
        return jsonify({
            'success': True,
            'data': {
                'dashboard': dashboard.to_dict()
            },
            'message': '已设置为默认仪表盘'
        })
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Set default grafana dashboard error: {e}")
        return jsonify({
            'success': False,
            'message': '设置默认仪表盘失败'
        }), 500


# ==================== Grafana 代理 API ====================

@grafana_bp.route('/proxy/<int:config_id>', methods=['GET', 'POST'])
def proxy_grafana(config_id):
    """
    Grafana 代理接口
    
    用于代理 Grafana 请求，自动添加认证信息
    支持 iframe 嵌入时的认证问题（无需系统登录 Token）
    
    Args:
        config_id: Grafana 配置 ID
    
    Query Parameters:
        - path: Grafana 路径（例如：/d/xxx/dashboard-name）
    
    Returns:
        代理后的 Grafana 响应
        
    Requirements: 认证支持
    """
    import requests
    from flask import Response, stream_with_context
    
    try:
        # 直接通过 ID 获取配置（不验证租户，允许 iframe 访问）
        config = GrafanaConfig.query.filter_by(id=config_id).first()
        
        if not config:
            return jsonify({
                'success': False,
                'message': 'Grafana 配置不存在'
            }), 404
        
        if not config.is_enabled():
            return jsonify({
                'success': False,
                'message': 'Grafana 配置已禁用'
            }), 403
        
        # 检查是否配置了认证信息
        has_auth = (
            (config.auth_type == 'basic' and config.auth_username and config.auth_password) or
            (config.auth_type == 'token' and config.auth_token) or
            (config.auth_type == 'api_key' and config.api_key) or
            config.allow_anonymous
        )
        
        if not has_auth:
            return jsonify({
                'success': False,
                'message': '未配置 Grafana 认证信息，请先在配置中设置认证方式'
            }), 403
        
        # 获取目标路径
        path = request.args.get('path', '/')
        target_url = f"{config.url.rstrip('/')}{path}"
        
        # 构建请求头
        headers = {}
        for key, value in request.headers:
            if key.lower() not in ['host', 'connection']:
                headers[key] = value
        
        # 添加认证信息
        if config.auth_type == 'basic' and config.auth_username and config.auth_password:
            # Basic Auth
            from base64 import b64encode
            credentials = f"{config.auth_username}:{config.auth_password}"
            encoded = b64encode(credentials.encode()).decode()
            headers['Authorization'] = f'Basic {encoded}'
            
        elif config.auth_type == 'token' and config.auth_token:
            # Bearer Token
            headers['Authorization'] = f'Bearer {config.auth_token}'
            
        elif config.auth_type == 'api_key' and config.api_key:
            # API Key
            headers['Authorization'] = f'Bearer {config.api_key}'
        
        # 发送代理请求
        if request.method == 'GET':
            resp = requests.get(
                target_url,
                headers=headers,
                params=request.args,
                stream=True,
                timeout=30
            )
        else:
            resp = requests.post(
                target_url,
                headers=headers,
                data=request.get_data(),
                stream=True,
                timeout=30
            )
        
        # 构建响应
        excluded_headers = ['content-encoding', 'content-length', 'transfer-encoding', 'connection']
        response_headers = [
            (name, value) for (name, value) in resp.raw.headers.items()
            if name.lower() not in excluded_headers
        ]
        
        # 添加 CORS 头
        response_headers.append(('Access-Control-Allow-Origin', '*'))
        response_headers.append(('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'))
        response_headers.append(('Access-Control-Allow-Headers', 'Content-Type, Authorization'))
        
        return Response(
            stream_with_context(resp.iter_content(chunk_size=1024)),
            status=resp.status_code,
            headers=response_headers
        )
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Grafana proxy error: {e}")
        return jsonify({
            'success': False,
            'message': f'代理请求失败: {str(e)}'
        }), 502
        
    except Exception as e:
        logger.error(f"Grafana proxy error: {e}")
        return jsonify({
            'success': False,
            'message': '代理请求失败'
        }), 500


@grafana_bp.route('/proxy/<int:config_id>', methods=['OPTIONS'])
def proxy_grafana_options(config_id):
    """处理 CORS 预检请求"""
    response = jsonify({'success': True})
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response


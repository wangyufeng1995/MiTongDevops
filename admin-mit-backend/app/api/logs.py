"""
操作日志 API
"""
from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, admin_required
from app.services.operation_log_service import operation_log_service
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

logs_bp = Blueprint('logs', __name__)


@logs_bp.route('', methods=['GET'])
@tenant_required
def get_logs():
    """
    获取操作日志列表
    
    Query Parameters:
        page: 页码 (默认: 1)
        per_page: 每页数量 (默认: 20, 最大: 100)
        search: 搜索关键词
        action: 操作类型过滤
        resource: 资源类型过滤
        user_id: 用户ID过滤
        start_date: 开始日期 (ISO格式)
        end_date: 结束日期 (ISO格式)
    """
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 20, type=int), 100)
        search = request.args.get('search', '').strip()
        action = request.args.get('action', '').strip()
        resource = request.args.get('resource', '').strip()
        user_id = request.args.get('user_id', type=int)
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        
        # 参数验证
        if page < 1:
            return jsonify({
                'success': False,
                'message': '页码必须大于0'
            }), 400
        
        if per_page < 1:
            return jsonify({
                'success': False,
                'message': '每页数量必须大于0'
            }), 400
        
        # 日期格式验证
        start_date_obj = None
        end_date_obj = None
        
        if start_date:
            try:
                start_date_obj = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '开始日期格式错误，请使用ISO格式'
                }), 400
        
        if end_date:
            try:
                end_date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '结束日期格式错误，请使用ISO格式'
                }), 400
        
        # 日期范围验证
        if start_date_obj and end_date_obj and start_date_obj > end_date_obj:
            return jsonify({
                'success': False,
                'message': '开始日期不能晚于结束日期'
            }), 400
        
        # 获取日志数据
        result = operation_log_service.get_logs(
            page=page,
            per_page=per_page,
            search=search if search else None,
            action=action if action else None,
            resource=resource if resource else None,
            user_id=user_id,
            start_date=start_date_obj,
            end_date=end_date_obj
        )
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Failed to get operation logs: {e}")
        return jsonify({
            'success': False,
            'message': '获取操作日志失败'
        }), 500


@logs_bp.route('/statistics', methods=['GET'])
@tenant_required
def get_log_statistics():
    """
    获取操作日志统计信息
    
    Query Parameters:
        days: 统计天数 (默认: 30, 最大: 365)
    """
    try:
        # 获取查询参数
        days = min(request.args.get('days', 30, type=int), 365)
        
        # 参数验证
        if days < 1:
            return jsonify({
                'success': False,
                'message': '统计天数必须大于0'
            }), 400
        
        # 获取统计数据
        result = operation_log_service.get_log_statistics(days=days)
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Failed to get operation log statistics: {e}")
        return jsonify({
            'success': False,
            'message': '获取操作日志统计失败'
        }), 500


@logs_bp.route('/actions', methods=['GET'])
@tenant_required
def get_available_actions():
    """获取可用的操作类型列表"""
    try:
        actions = operation_log_service.get_available_actions()
        
        return jsonify({
            'success': True,
            'data': actions
        })
        
    except Exception as e:
        logger.error(f"Failed to get available actions: {e}")
        return jsonify({
            'success': False,
            'message': '获取操作类型列表失败'
        }), 500


@logs_bp.route('/resources', methods=['GET'])
@tenant_required
def get_available_resources():
    """获取可用的资源类型列表"""
    try:
        resources = operation_log_service.get_available_resources()
        
        return jsonify({
            'success': True,
            'data': resources
        })
        
    except Exception as e:
        logger.error(f"Failed to get available resources: {e}")
        return jsonify({
            'success': False,
            'message': '获取资源类型列表失败'
        }), 500


@logs_bp.route('/export', methods=['GET'])
@admin_required
def export_logs():
    """
    导出操作日志 (管理员权限)
    
    Query Parameters:
        format: 导出格式 (csv, excel) 默认: csv
        search: 搜索关键词
        action: 操作类型过滤
        resource: 资源类型过滤
        user_id: 用户ID过滤
        start_date: 开始日期 (ISO格式)
        end_date: 结束日期 (ISO格式)
        limit: 导出数量限制 (默认: 10000, 最大: 50000)
    """
    try:
        # 获取查询参数
        export_format = request.args.get('format', 'csv').lower()
        search = request.args.get('search', '').strip()
        action = request.args.get('action', '').strip()
        resource = request.args.get('resource', '').strip()
        user_id = request.args.get('user_id', type=int)
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        limit = min(request.args.get('limit', 10000, type=int), 50000)
        
        # 格式验证
        if export_format not in ['csv', 'excel']:
            return jsonify({
                'success': False,
                'message': '不支持的导出格式，支持: csv, excel'
            }), 400
        
        # 日期格式验证
        start_date_obj = None
        end_date_obj = None
        
        if start_date:
            try:
                start_date_obj = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '开始日期格式错误，请使用ISO格式'
                }), 400
        
        if end_date:
            try:
                end_date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            except ValueError:
                return jsonify({
                    'success': False,
                    'message': '结束日期格式错误，请使用ISO格式'
                }), 400
        
        # 获取日志数据（不分页，但有数量限制）
        result = operation_log_service.get_logs(
            page=1,
            per_page=limit,
            search=search if search else None,
            action=action if action else None,
            resource=resource if resource else None,
            user_id=user_id,
            start_date=start_date_obj,
            end_date=end_date_obj
        )
        
        logs = result['logs']
        
        if export_format == 'csv':
            # 生成CSV格式数据
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # 写入表头
            headers = ['ID', '用户名', '操作类型', '资源类型', '资源ID', 'IP地址', '操作时间', '操作详情']
            writer.writerow(headers)
            
            # 写入数据
            for log in logs:
                writer.writerow([
                    log.get('id', ''),
                    log.get('username', ''),
                    log.get('action', ''),
                    log.get('resource', ''),
                    log.get('resource_id', ''),
                    log.get('ip_address', ''),
                    log.get('created_at', ''),
                    str(log.get('details', ''))
                ])
            
            csv_data = output.getvalue()
            output.close()
            
            return jsonify({
                'success': True,
                'data': {
                    'format': 'csv',
                    'content': csv_data,
                    'filename': f'operation_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv',
                    'count': len(logs)
                }
            })
        
        else:  # excel format
            # 对于Excel格式，返回数据让前端处理
            return jsonify({
                'success': True,
                'data': {
                    'format': 'excel',
                    'logs': logs,
                    'filename': f'operation_logs_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx',
                    'count': len(logs)
                }
            })
        
    except Exception as e:
        logger.error(f"Failed to export operation logs: {e}")
        return jsonify({
            'success': False,
            'message': '导出操作日志失败'
        }), 500


@logs_bp.route('/<int:log_id>/delete', methods=['POST'])
@tenant_required
def delete_log(log_id):
    """
    删除单条操作日志 (需要管理员角色)
    """
    try:
        # 检查是否有管理员角色
        user_roles = getattr(g, 'user_roles', [])
        is_admin = any(role in user_roles for role in ['admin', 'super_admin', 'Admin', 'Super_Admin', '超级管理员', '管理员'])
        
        if not is_admin:
            return jsonify({
                'success': False,
                'message': '需要管理员权限'
            }), 403
        
        result = operation_log_service.delete_log(log_id)
        if result:
            return jsonify({
                'success': True,
                'message': '删除成功'
            })
        else:
            return jsonify({
                'success': False,
                'message': '日志不存在'
            }), 404
    except Exception as e:
        logger.error(f"Failed to delete operation log {log_id}: {e}")
        return jsonify({
            'success': False,
            'message': '删除操作日志失败'
        }), 500


@logs_bp.route('/batch-delete', methods=['POST'])
@tenant_required
def batch_delete_logs():
    """
    批量删除操作日志 (需要管理员角色)
    
    Request Body:
        ids: 要删除的日志ID列表
    """
    try:
        # 检查是否有管理员角色
        user_roles = getattr(g, 'user_roles', [])
        is_admin = any(role in user_roles for role in ['admin', 'super_admin', 'Admin', 'Super_Admin', '超级管理员', '管理员'])
        
        if not is_admin:
            return jsonify({
                'success': False,
                'message': '需要管理员权限'
            }), 403
        
        data = request.get_json()
        ids = data.get('ids', [])
        
        if not ids:
            return jsonify({
                'success': False,
                'message': '请选择要删除的日志'
            }), 400
        
        deleted_count = operation_log_service.batch_delete_logs(ids)
        
        return jsonify({
            'success': True,
            'message': f'成功删除 {deleted_count} 条日志',
            'data': {
                'deleted_count': deleted_count
            }
        })
    except Exception as e:
        logger.error(f"Failed to batch delete operation logs: {e}")
        return jsonify({
            'success': False,
            'message': '批量删除操作日志失败'
        }), 500


@logs_bp.route('/clear', methods=['POST'])
@tenant_required
def clear_logs():
    """
    清空操作日志 (需要管理员角色)
    
    Request Body:
        days: 保留最近多少天的日志 (默认: 0, 表示全部清空)
    """
    try:
        # 检查是否有管理员角色
        user_roles = getattr(g, 'user_roles', [])
        logger.info(f"Clear logs - user roles: {user_roles}")
        
        # 检查多种管理员角色名称
        is_admin = any(role in user_roles for role in ['admin', 'super_admin', 'Admin', 'Super_Admin', '超级管理员', '管理员'])
        
        if not is_admin:
            logger.warning(f"Clear logs denied - user roles: {user_roles}")
            return jsonify({
                'success': False,
                'message': f'需要管理员权限，当前角色: {user_roles}'
            }), 403
        
        data = request.get_json() or {}
        days = data.get('days', 0)
        
        deleted_count = operation_log_service.clear_logs(days)
        
        return jsonify({
            'success': True,
            'message': f'成功清空 {deleted_count} 条日志',
            'data': {
                'deleted_count': deleted_count
            }
        })
    except Exception as e:
        logger.error(f"Failed to clear operation logs: {e}")
        return jsonify({
            'success': False,
            'message': '清空操作日志失败'
        }), 500
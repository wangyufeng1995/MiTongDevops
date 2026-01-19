"""
系统设置 API
"""
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required
from app.core.middleware import tenant_required, role_required, csrf_required
from app.services.system import SystemService
from app.models.system import SystemSetting
from app.extensions import db
from app.utils.response import success_response, error_response
from app.utils.validation import validate_required_fields
import logging

logger = logging.getLogger(__name__)

system_bp = Blueprint('system', __name__, url_prefix='/api/system')


@system_bp.route('/config', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_system_config():
    """
    获取系统配置
    
    Returns:
        JSON: 系统配置信息
    """
    try:
        tenant_id = g.tenant_id
        
        # 获取系统配置
        config = SystemService.get_system_config(tenant_id)
        
        return success_response(
            data=config,
            message="系统配置获取成功"
        )
        
    except Exception as e:
        logger.error(f"获取系统配置失败: {str(e)}")
        return error_response(
            message="获取系统配置失败",
            details=str(e)
        ), 500


@system_bp.route('/config', methods=['POST'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def update_system_config():
    """
    更新系统配置
    
    Request Body:
        {
            "system": {
                "system_name": "系统名称",
                "system_version": "版本号",
                ...
            },
            "security": {
                "max_login_attempts": 5,
                ...
            }
        }
    
    Returns:
        JSON: 更新结果
    """
    try:
        data = request.get_json()
        if not data:
            return error_response(message="请求数据不能为空"), 400
        
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        # 更新系统配置
        SystemService.update_system_config(data, tenant_id, user_id)
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='update',
            resource='system',
            resource_id=None,
            details=f"更新系统配置: {list(data.keys())}"
        )
        
        return success_response(
            message="系统配置更新成功"
        )
        
    except Exception as e:
        logger.error(f"更新系统配置失败: {str(e)}")
        return error_response(
            message="更新系统配置失败",
            details=str(e)
        ), 500


@system_bp.route('/info', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_system_info():
    """
    获取系统信息
    
    Returns:
        JSON: 系统硬件和运行信息
    """
    try:
        # 获取系统信息
        system_info = SystemService.get_system_info()
        
        return success_response(
            data=system_info,
            message="系统信息获取成功"
        )
        
    except Exception as e:
        logger.error(f"获取系统信息失败: {str(e)}")
        return error_response(
            message="获取系统信息失败",
            details=str(e)
        ), 500


@system_bp.route('/maintenance', methods=['GET'])
@jwt_required()
@tenant_required
def get_maintenance_status():
    """
    获取维护模式状态（所有用户可访问）
    
    Returns:
        JSON: 维护模式状态
    """
    try:
        tenant_id = g.tenant_id
        
        # 获取维护模式状态
        maintenance_status = SystemService.get_maintenance_status(tenant_id)
        
        return success_response(
            data=maintenance_status,
            message="维护模式状态获取成功"
        )
        
    except Exception as e:
        logger.error(f"获取维护模式状态失败: {str(e)}")
        return error_response(
            message="获取维护模式状态失败",
            details=str(e)
        ), 500


@system_bp.route('/maintenance', methods=['PUT'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def set_maintenance_mode():
    """
    设置维护模式
    
    Request Body:
        {
            "enabled": true,
            "message": "维护提示消息"
        }
    
    Returns:
        JSON: 设置结果
    """
    try:
        data = request.get_json()
        if not data:
            return error_response(message="请求数据不能为空"), 400
        
        # 验证必需字段
        required_fields = ['enabled']
        validation_error = validate_required_fields(data, required_fields)
        if validation_error:
            return error_response(message=validation_error), 400
        
        tenant_id = g.tenant_id
        user_id = g.user_id
        enabled = data['enabled']
        message = data.get('message')
        
        # 设置维护模式
        SystemService.set_maintenance_mode(enabled, message, tenant_id, user_id)
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='set_maintenance',
            resource='system',
            resource_id=None,
            details=f"设置维护模式: {'启用' if enabled else '禁用'}"
        )
        
        return success_response(
            message=f"维护模式{'启用' if enabled else '禁用'}成功"
        )
        
    except Exception as e:
        logger.error(f"设置维护模式失败: {str(e)}")
        return error_response(
            message="设置维护模式失败",
            details=str(e)
        ), 500


@system_bp.route('/settings', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_settings():
    """
    获取系统设置列表
    
    Query Parameters:
        category: 设置分类（可选）
        page: 页码（默认1）
        per_page: 每页数量（默认20）
    
    Returns:
        JSON: 设置列表
    """
    try:
        tenant_id = g.tenant_id
        category = request.args.get('category')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        # 构建查询
        query = SystemSetting.query_by_tenant(tenant_id)
        
        if category:
            query = query.filter(SystemSetting.category == category)
        
        # 分页查询
        pagination = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False
        )
        
        settings = [setting.to_dict() for setting in pagination.items]
        
        return success_response(
            data={
                'settings': settings,
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            },
            message="设置列表获取成功"
        )
        
    except Exception as e:
        logger.error(f"获取设置列表失败: {str(e)}")
        return error_response(
            message="获取设置列表失败",
            details=str(e)
        ), 500


@system_bp.route('/settings/<setting_key>', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_setting(setting_key):
    """
    获取单个设置
    
    Args:
        setting_key: 设置键名
    
    Returns:
        JSON: 设置详情
    """
    try:
        tenant_id = g.tenant_id
        
        setting = SystemSetting.query.filter(
            SystemSetting.tenant_id == tenant_id,
            SystemSetting.key == setting_key
        ).first()
        
        if not setting:
            return error_response(message="设置不存在"), 404
        
        return success_response(
            data=setting.to_dict(),
            message="设置获取成功"
        )
        
    except Exception as e:
        logger.error(f"获取设置失败: {str(e)}")
        return error_response(
            message="获取设置失败",
            details=str(e)
        ), 500


@system_bp.route('/settings/<setting_key>', methods=['PUT'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def update_setting(setting_key):
    """
    更新单个设置
    
    Args:
        setting_key: 设置键名
    
    Request Body:
        {
            "value": "设置值",
            "description": "设置描述"
        }
    
    Returns:
        JSON: 更新结果
    """
    try:
        data = request.get_json()
        if not data:
            return error_response(message="请求数据不能为空"), 400
        
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        # 查找设置
        setting = SystemSetting.query.filter(
            SystemSetting.tenant_id == tenant_id,
            SystemSetting.key == setting_key
        ).first()
        
        if not setting:
            return error_response(message="设置不存在"), 404
        
        # 更新设置
        if 'value' in data:
            setting.value = data['value']
        if 'description' in data:
            setting.description = data['description']
        
        setting.updated_by = user_id
        setting.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='update',
            resource='system',
            resource_id=setting.id,
            details=f"更新设置: {setting_key}"
        )
        
        return success_response(
            data=setting.to_dict(),
            message="设置更新成功"
        )
        
    except Exception as e:
        logger.error(f"更新设置失败: {str(e)}")
        return error_response(
            message="更新设置失败",
            details=str(e)
        ), 500


@system_bp.route('/settings/export', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def export_settings():
    """
    导出系统设置
    
    Returns:
        JSON: 导出的设置数据
    """
    try:
        tenant_id = g.tenant_id
        
        # 导出设置
        export_data = SystemService.export_settings(tenant_id)
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='export',
            resource='system',
            resource_id=None,
            details="导出系统设置"
        )
        
        return success_response(
            data=export_data,
            message="设置导出成功"
        )
        
    except Exception as e:
        logger.error(f"导出设置失败: {str(e)}")
        return error_response(
            message="导出设置失败",
            details=str(e)
        ), 500


@system_bp.route('/settings/import', methods=['POST'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def import_settings():
    """
    导入系统设置
    
    Request Body:
        {
            "settings": {
                "key1": {
                    "value": "value1",
                    "category": "category1",
                    "description": "description1"
                }
            }
        }
    
    Returns:
        JSON: 导入结果
    """
    try:
        data = request.get_json()
        if not data:
            return error_response(message="请求数据不能为空"), 400
        
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        # 导入设置
        SystemService.import_settings(data, tenant_id, user_id)
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='import',
            resource='system',
            resource_id=None,
            details="导入系统设置"
        )
        
        return success_response(
            message="设置导入成功"
        )
        
    except Exception as e:
        logger.error(f"导入设置失败: {str(e)}")
        return error_response(
            message="导入设置失败",
            details=str(e)
        ), 500


@system_bp.route('/initialize', methods=['POST'])
@jwt_required()
@tenant_required
@role_required('super_admin', '超级管理员')
@csrf_required
def initialize_default_settings():
    """
    初始化默认系统设置（仅超级管理员）
    
    Returns:
        JSON: 初始化结果
    """
    try:
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        # 初始化默认设置
        SystemService.initialize_default_settings(tenant_id, user_id)
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='initialize',
            resource='system',
            resource_id=None,
            details="初始化默认系统设置"
        )
        
        return success_response(
            message="默认设置初始化成功"
        )
        
    except Exception as e:
        logger.error(f"初始化默认设置失败: {str(e)}")
        return error_response(
            message="初始化默认设置失败",
            details=str(e)
        ), 500


@system_bp.route('/security/stats', methods=['GET'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def get_security_stats():
    """
    获取安全统计数据
    
    Returns:
        JSON: 安全统计信息（今日失败登录、锁定账户、活跃会话等）
    """
    try:
        from datetime import datetime, timedelta
        from app.models.operation_log import OperationLog
        from app.models.user import User
        from sqlalchemy import func
        
        tenant_id = g.tenant_id
        today = datetime.utcnow().date()
        today_start = datetime.combine(today, datetime.min.time())
        
        # 今日失败登录次数
        failed_logins_today = OperationLog.query.filter(
            OperationLog.tenant_id == tenant_id,
            OperationLog.action == 'login_failed',
            OperationLog.created_at >= today_start
        ).count()
        
        # 锁定账户数（status=0 表示禁用/锁定）
        locked_accounts = User.query.filter(
            User.tenant_id == tenant_id,
            User.status == 0
        ).count()
        
        # 活跃会话数（最近2小时内有操作的用户数）
        two_hours_ago = datetime.utcnow() - timedelta(hours=2)
        active_sessions = db.session.query(func.count(func.distinct(OperationLog.user_id))).filter(
            OperationLog.tenant_id == tenant_id,
            OperationLog.created_at >= two_hours_ago
        ).scalar() or 0
        
        # 密码即将过期的用户数（假设90天过期，提前7天提醒）
        # 由于当前User模型没有password_changed_at字段，暂时返回0
        password_expiring_soon = 0
        
        # 今日安全事件数（登录失败 + 安全违规）
        security_events_today = OperationLog.query.filter(
            OperationLog.tenant_id == tenant_id,
            OperationLog.action.in_(['login_failed', 'security_violation']),
            OperationLog.created_at >= today_start
        ).count()
        
        # 最后安全扫描时间（从系统设置获取，如果没有则返回None）
        last_scan_setting = SystemSetting.query.filter(
            SystemSetting.tenant_id == tenant_id,
            SystemSetting.key == 'security.last_scan_time'
        ).first()
        last_security_scan = last_scan_setting.value if last_scan_setting else None
        
        return success_response(
            data={
                'failed_logins_today': failed_logins_today,
                'locked_accounts': locked_accounts,
                'active_sessions': active_sessions,
                'password_expiring_soon': password_expiring_soon,
                'security_events_today': security_events_today,
                'last_security_scan': last_security_scan
            },
            message="安全统计获取成功"
        )
        
    except Exception as e:
        logger.error(f"获取安全统计失败: {str(e)}")
        return error_response(
            message="获取安全统计失败",
            details=str(e)
        ), 500


@system_bp.route('/security/unlock-all', methods=['POST'])
@jwt_required()
@tenant_required
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
@csrf_required
def unlock_all_accounts():
    """
    解锁所有被锁定的账户
    
    Returns:
        JSON: 解锁结果
    """
    try:
        from app.models.user import User
        
        tenant_id = g.tenant_id
        user_id = g.user_id
        
        # 查找所有被锁定的账户
        locked_users = User.query.filter(
            User.tenant_id == tenant_id,
            User.status == 0
        ).all()
        
        if not locked_users:
            return success_response(
                data={'unlocked_count': 0},
                message="没有需要解锁的账户"
            )
        
        # 解锁所有账户
        unlocked_count = 0
        unlocked_usernames = []
        for user in locked_users:
            user.status = 1
            unlocked_count += 1
            unlocked_usernames.append(user.username)
        
        db.session.commit()
        
        # 记录操作日志
        from app.services.operation_log_service import operation_log_service
        operation_log_service.log_operation(
            action='unlock_all',
            resource='user',
            resource_id=None,
            details=f"批量解锁 {unlocked_count} 个账户: {', '.join(unlocked_usernames)}"
        )
        
        return success_response(
            data={
                'unlocked_count': unlocked_count,
                'unlocked_users': unlocked_usernames
            },
            message=f"成功解锁 {unlocked_count} 个账户"
        )
        
    except Exception as e:
        logger.error(f"解锁账户失败: {str(e)}")
        db.session.rollback()
        return error_response(
            message="解锁账户失败",
            details=str(e)
        ), 500
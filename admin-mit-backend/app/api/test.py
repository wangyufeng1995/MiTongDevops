from flask import Blueprint, request, jsonify, g
from app.core.middleware import tenant_required, csrf_required, csrf_exempt
from app.services.auth_service import auth_service
import logging

logger = logging.getLogger(__name__)
test_bp = Blueprint('test', __name__)

@test_bp.route('/csrf-test', methods=['POST'])
@csrf_required
def csrf_test():
    """CSRF 保护测试端点"""
    try:
        data = request.get_json()
        message = data.get('message', 'No message')
        
        return jsonify({
            'success': True,
            'message': 'CSRF 验证通过',
            'data': {
                'received_message': message,
                'endpoint': 'csrf-protected'
            }
        })
        
    except Exception as e:
        logger.error(f"CSRF test error: {e}")
        return jsonify({
            'success': False,
            'message': 'CSRF 测试失败'
        }), 500

@test_bp.route('/no-csrf-test', methods=['POST'])
@csrf_exempt
def no_csrf_test():
    """无 CSRF 保护测试端点"""
    try:
        data = request.get_json()
        message = data.get('message', 'No message')
        
        return jsonify({
            'success': True,
            'message': '无需 CSRF 验证',
            'data': {
                'received_message': message,
                'endpoint': 'no-csrf-protection'
            }
        })
        
    except Exception as e:
        logger.error(f"No CSRF test error: {e}")
        return jsonify({
            'success': False,
            'message': '测试失败'
        }), 500

@test_bp.route('/tenant-test', methods=['GET'])
@tenant_required
def tenant_test():
    """多租户测试端点"""
    try:
        current_user = auth_service.get_current_user()
        current_tenant = auth_service.get_current_tenant()
        
        return jsonify({
            'success': True,
            'message': '多租户验证通过',
            'data': {
                'user_id': g.user_id,
                'tenant_id': g.tenant_id,
                'user_roles': g.user_roles,
                'user_info': current_user.to_dict() if current_user else None,
                'tenant_info': current_tenant.to_dict() if current_tenant else None
            }
        })
        
    except Exception as e:
        logger.error(f"Tenant test error: {e}")
        return jsonify({
            'success': False,
            'message': '多租户测试失败'
        }), 500

@test_bp.route('/health', methods=['GET'])
@csrf_exempt
def health_check():
    """健康检查端点"""
    return jsonify({
        'success': True,
        'message': '服务正常',
        'data': {
            'status': 'healthy',
            'service': 'admin-system-template'
        }
    })

@test_bp.route('/auth-info', methods=['GET'])
@tenant_required
def auth_info():
    """获取认证信息"""
    try:
        current_user = auth_service.get_current_user()
        current_tenant = auth_service.get_current_tenant()
        
        # 获取用户权限
        user_permissions = set()
        if current_user:
            for role in current_user.get_roles():
                permissions = role.permissions or []
                user_permissions.update(permissions)
        
        return jsonify({
            'success': True,
            'data': {
                'user': {
                    'id': current_user.id if current_user else None,
                    'username': current_user.username if current_user else None,
                    'email': current_user.email if current_user else None,
                    'full_name': current_user.full_name if current_user else None,
                    'roles': [role.name for role in current_user.get_roles()] if current_user else [],
                    'permissions': list(user_permissions)
                },
                'tenant': {
                    'id': current_tenant.id if current_tenant else None,
                    'name': current_tenant.name if current_tenant else None,
                    'code': current_tenant.code if current_tenant else None
                },
                'context': {
                    'user_id': g.user_id,
                    'tenant_id': g.tenant_id,
                    'user_roles': g.user_roles
                }
            }
        })
        
    except Exception as e:
        logger.error(f"Auth info error: {e}")
        return jsonify({
            'success': False,
            'message': '获取认证信息失败'
        }), 500
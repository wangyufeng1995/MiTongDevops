from flask import Blueprint, request, jsonify, g
from app.services.user_service import user_service
from app.core.middleware import tenant_required, admin_required, role_required
from app.services.auth_service import auth_service
from app.models.user import User
import logging

logger = logging.getLogger(__name__)
users_bp = Blueprint('users', __name__)

@users_bp.route('', methods=['GET'])
@tenant_required
def get_users():
    """获取用户列表"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '')
        
        # 限制每页最大数量
        per_page = min(per_page, 100)
        
        result = user_service.get_users_paginated(page, per_page, search)
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        logger.error(f"Get users error: {e}")
        return jsonify({
            'success': False,
            'message': '获取用户列表失败'
        }), 500

@users_bp.route('/check-username', methods=['GET'])
@tenant_required
def check_username():
    """检查用户名是否可用"""
    try:
        username = request.args.get('username')
        exclude_id = request.args.get('exclude_id', type=int)
        
        if not username:
            return jsonify({
                'success': False,
                'message': '用户名不能为空'
            }), 400
        
        # 检查用户名是否已存在
        query = User.query_by_tenant().filter(User.username == username)
        if exclude_id:
            query = query.filter(User.id != exclude_id)
        
        existing_user = query.first()
        available = existing_user is None
        
        return jsonify({
            'success': True,
            'data': {
                'available': available
            }
        })
        
    except Exception as e:
        logger.error(f"Check username error: {e}")
        return jsonify({
            'success': False,
            'message': '检查用户名失败'
        }), 500

@users_bp.route('/check-email', methods=['GET'])
@tenant_required
def check_email():
    """检查邮箱是否可用"""
    try:
        email = request.args.get('email')
        exclude_id = request.args.get('exclude_id', type=int)
        
        if not email:
            return jsonify({
                'success': False,
                'message': '邮箱不能为空'
            }), 400
        
        # 检查邮箱是否已存在
        query = User.query_by_tenant().filter(User.email == email)
        if exclude_id:
            query = query.filter(User.id != exclude_id)
        
        existing_user = query.first()
        available = existing_user is None
        
        return jsonify({
            'success': True,
            'data': {
                'available': available
            }
        })
        
    except Exception as e:
        logger.error(f"Check email error: {e}")
        return jsonify({
            'success': False,
            'message': '检查邮箱失败'
        }), 500

@users_bp.route('', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def create_user():
    """创建用户"""
    try:
        data = request.get_json()
        
        user = user_service.create_user(data)
        
        return jsonify({
            'success': True,
            'data': {
                'user': user
            }
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Create user error: {e}")
        return jsonify({
            'success': False,
            'message': '用户创建失败'
        }), 500

@users_bp.route('/<int:user_id>', methods=['GET'])
@tenant_required
def get_user(user_id):
    """获取用户详情"""
    try:
        user = user_service.get_user_by_id(user_id)
        if not user:
            return jsonify({
                'success': False,
                'message': '用户不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'data': {
                'user': user
            }
        })
        
    except Exception as e:
        logger.error(f"Get user error: {e}")
        return jsonify({
            'success': False,
            'message': '获取用户信息失败'
        }), 500

@users_bp.route('/<int:user_id>', methods=['PUT'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def update_user(user_id):
    """更新用户"""
    try:
        data = request.get_json()
        
        user = user_service.update_user(user_id, data)
        
        return jsonify({
            'success': True,
            'data': {
                'user': user
            }
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Update user error: {e}")
        return jsonify({
            'success': False,
            'message': '用户更新失败'
        }), 500

@users_bp.route('/<int:user_id>/delete', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def delete_user(user_id):
    """删除用户"""
    try:
        current_user = auth_service.get_current_user()
        current_user_id = current_user.id if current_user else None
        
        user_service.delete_user(user_id, current_user_id)
        
        return jsonify({
            'success': True,
            'message': '用户删除成功'
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Delete user error: {e}")
        return jsonify({
            'success': False,
            'message': '用户删除失败'
        }), 500

@users_bp.route('/<int:user_id>/avatar', methods=['GET'])
@tenant_required
def get_user_avatar(user_id):
    """获取用户头像信息"""
    try:
        avatar_info = user_service.get_user_avatar(user_id)
        
        return jsonify({
            'success': True,
            'data': avatar_info
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 404
    except Exception as e:
        logger.error(f"Get user avatar error: {e}")
        return jsonify({
            'success': False,
            'message': '获取头像信息失败'
        }), 500

@users_bp.route('/<int:user_id>/avatar', methods=['PUT'])
@tenant_required
def update_user_avatar(user_id):
    """更新用户头像配置"""
    try:
        data = request.get_json()
        
        current_user = auth_service.get_current_user()
        current_user_id = current_user.id if current_user else None
        is_admin = auth_service.has_role('admin') or auth_service.has_role('super_admin')
        
        avatar_info = user_service.update_user_avatar(user_id, data, current_user_id, is_admin)
        
        return jsonify({
            'success': True,
            'data': avatar_info
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 403 if '权限不足' in str(e) else 404
    except Exception as e:
        logger.error(f"Update user avatar error: {e}")
        return jsonify({
            'success': False,
            'message': '更新头像失败'
        }), 500

@users_bp.route('/<int:user_id>/avatar/generate', methods=['POST'])
@tenant_required
def generate_user_avatar(user_id):
    """生成随机头像"""
    try:
        current_user = auth_service.get_current_user()
        current_user_id = current_user.id if current_user else None
        is_admin = auth_service.has_role('admin') or auth_service.has_role('super_admin')
        
        avatar_info = user_service.generate_user_avatar(user_id, current_user_id, is_admin)
        
        return jsonify({
            'success': True,
            'data': avatar_info
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 403 if '权限不足' in str(e) else 404
    except Exception as e:
        logger.error(f"Generate user avatar error: {e}")
        return jsonify({
            'success': False,
            'message': '生成头像失败'
        }), 500

@users_bp.route('/<int:user_id>/change-password', methods=['POST'])
@tenant_required
def change_password(user_id):
    """修改密码"""
    try:
        data = request.get_json()
        current_user = auth_service.get_current_user()
        current_user_id = current_user.id if current_user else None
        is_admin = auth_service.has_role('admin') or auth_service.has_role('super_admin')
        
        # 只能修改自己的密码或管理员可以修改任何用户的密码
        if current_user_id != user_id and not is_admin:
            return jsonify({
                'success': False,
                'message': '权限不足'
            }), 403
        
        # 验证必填字段
        if not data.get('new_password'):
            return jsonify({
                'success': False,
                'message': '新密码不能为空'
            }), 400
        
        # 如果是修改自己的密码，需要验证当前密码
        if current_user_id == user_id and not is_admin:
            if not data.get('current_password'):
                return jsonify({
                    'success': False,
                    'message': '当前密码不能为空'
                }), 400
            
            # 验证当前密码
            user = user_service.get_user_by_id(user_id)
            if not user or not current_user.check_password(data['current_password']):
                return jsonify({
                    'success': False,
                    'message': '当前密码错误'
                }), 400
        
        # 更新密码
        user_service.update_user(user_id, {'password': data['new_password']})
        
        return jsonify({
            'success': True,
            'message': '密码修改成功'
        })
        
    except Exception as e:
        logger.error(f"Change password error: {e}")
        return jsonify({
            'success': False,
            'message': '密码修改失败'
        }), 500

@users_bp.route('/<int:user_id>/reset-password', methods=['POST'])
@role_required('admin', 'super_admin', '超级管理员', '运维管理员', '系统管理员')
def reset_password(user_id):
    """重置密码（仅管理员）"""
    try:
        data = request.get_json()
        
        if not data.get('new_password'):
            return jsonify({
                'success': False,
                'message': '新密码不能为空'
            }), 400
        
        # 重置密码
        user_service.update_user(user_id, {'password': data['new_password']})
        
        return jsonify({
            'success': True,
            'message': '密码重置成功'
        })
        
    except Exception as e:
        logger.error(f"Reset password error: {e}")
        return jsonify({
            'success': False,
            'message': '密码重置失败'
        }), 500
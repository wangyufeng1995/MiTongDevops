"""
角色管理 API
"""
import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.role_service import role_service
from app.core.middleware import tenant_required

logger = logging.getLogger(__name__)

# 创建蓝图
roles_bp = Blueprint('roles', __name__, url_prefix='/api/roles')


@roles_bp.route('', methods=['GET'])
@tenant_required
def get_roles():
    """获取角色列表"""
    try:
        # 获取查询参数
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        search = request.args.get('search', '', type=str)
        all_roles = request.args.get('all', False, type=bool)
        
        # 限制每页数量
        per_page = min(per_page, 100)
        
        if all_roles:
            # 获取所有角色（不分页）
            roles = role_service.get_all_roles()
            return jsonify({
                'success': True,
                'data': {
                    'items': roles,
                    'total': len(roles)
                }
            })
        else:
            # 获取分页角色列表
            result = role_service.get_roles_paginated(page, per_page, search)
            return jsonify({
                'success': True,
                'data': {
                    'items': result['roles'],
                    'total': result['pagination']['total'],
                    'pagination': result['pagination']
                }
            })
            
    except Exception as e:
        logger.error(f"Get roles error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取角色列表失败: {str(e)}'
        }), 500


@roles_bp.route('/<int:role_id>', methods=['GET'])
@tenant_required
def get_role(role_id):
    """获取单个角色详情"""
    try:
        role = role_service.get_role_by_id(role_id)
        if not role:
            return jsonify({
                'success': False,
                'message': '角色不存在'
            }), 404
        
        return jsonify({
            'success': True,
            'message': '获取角色详情成功',
            'data': role
        })
        
    except Exception as e:
        logger.error(f"Get role error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取角色详情失败: {str(e)}'
        }), 500


@roles_bp.route('', methods=['POST'])
@tenant_required
def create_role():
    """创建角色"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        # 验证必填字段
        if not data.get('name'):
            return jsonify({
                'success': False,
                'message': '角色名称不能为空'
            }), 400
        
        role = role_service.create_role(data)
        
        return jsonify({
            'success': True,
            'message': '创建角色成功',
            'data': role
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Create role error: {e}")
        return jsonify({
            'success': False,
            'message': f'创建角色失败: {str(e)}'
        }), 500


@roles_bp.route('/<int:role_id>', methods=['PUT'])
@tenant_required
def update_role(role_id):
    """更新角色"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        role = role_service.update_role(role_id, data)
        
        return jsonify({
            'success': True,
            'message': '更新角色成功',
            'data': role
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Update role error: {e}")
        return jsonify({
            'success': False,
            'message': f'更新角色失败: {str(e)}'
        }), 500


@roles_bp.route('/<int:role_id>/delete', methods=['POST'])
@tenant_required
def delete_role(role_id):
    """删除角色"""
    try:
        role_service.delete_role(role_id)
        
        return jsonify({
            'success': True,
            'message': '删除角色成功'
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Delete role error: {e}")
        return jsonify({
            'success': False,
            'message': f'删除角色失败: {str(e)}'
        }), 500


@roles_bp.route('/<int:role_id>/permissions', methods=['GET'])
@tenant_required
def get_role_permissions(role_id):
    """获取角色权限"""
    try:
        permissions = role_service.get_role_permissions(role_id)
        
        return jsonify({
            'success': True,
            'message': '获取角色权限成功',
            'data': {
                'permissions': permissions
            }
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get role permissions error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取角色权限失败: {str(e)}'
        }), 500


@roles_bp.route('/<int:role_id>/permissions', methods=['PUT'])
@tenant_required
def update_role_permissions(role_id):
    """更新角色权限"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'success': False,
                'message': '请求数据不能为空'
            }), 400
        
        permissions = data.get('permissions', [])
        role = role_service.update_role_permissions(role_id, permissions)
        
        return jsonify({
            'success': True,
            'message': '更新角色权限成功',
            'data': role
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Update role permissions error: {e}")
        return jsonify({
            'success': False,
            'message': f'更新角色失败: {str(e)}'
        }), 500


@roles_bp.route('/<int:role_id>/users', methods=['GET'])
@tenant_required
def get_role_users(role_id):
    """获取角色关联的用户列表"""
    try:
        users = role_service.get_role_users(role_id)
        
        return jsonify({
            'success': True,
            'message': '获取角色用户列表成功',
            'data': {
                'users': users,
                'total': len(users)
            }
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    except Exception as e:
        logger.error(f"Get role users error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取角色用户列表失败: {str(e)}'
        }), 500


@roles_bp.route('/permissions', methods=['GET'])
@tenant_required
def get_available_permissions():
    """获取可用权限列表"""
    try:
        permissions = role_service.get_available_permissions()
        
        return jsonify({
            'success': True,
            'message': '获取权限列表成功',
            'data': permissions
        })
        
    except Exception as e:
        logger.error(f"Get available permissions error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取权限列表失败: {str(e)}'
        }), 500
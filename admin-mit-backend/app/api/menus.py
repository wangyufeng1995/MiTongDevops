"""
菜单管理 API
"""
import logging
from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.menu_service import menu_service
from app.core.middleware import tenant_required

logger = logging.getLogger(__name__)

# 创建蓝图
menus_bp = Blueprint('menus', __name__)


@menus_bp.route('/tree', methods=['GET'])
@tenant_required
def get_menu_tree():
    """获取菜单树"""
    try:
        menus = menu_service.get_menu_tree()
        return jsonify({
            'success': True,
            'data': {
                'menus': menus
            }
        })
        
    except Exception as e:
        logger.error(f"Get menu tree error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取菜单树失败: {str(e)}'
        }), 500


@menus_bp.route('/user-menus', methods=['GET'])
@tenant_required
def get_user_menus():
    """获取当前用户的菜单（根据权限过滤）"""
    try:
        # 获取用户角色权限
        user_roles = getattr(g, 'user_roles', [])
        
        # 管理员角色获取所有菜单
        admin_roles = ['admin', 'super_admin', '超级管理员', '系统管理员', '运维管理员']
        is_admin = any(role in user_roles for role in admin_roles)
        
        if is_admin:
            menus = menu_service.get_menu_tree()
        else:
            # 普通用户根据权限获取菜单
            menus = menu_service.get_user_menus(g.user_id)
        
        # 直接返回菜单数组，前端期望 data 是数组
        return jsonify({
            'success': True,
            'data': menus
        })
        
    except Exception as e:
        logger.error(f"Get user menus error: {e}")
        return jsonify({
            'success': False,
            'message': f'获取用户菜单失败: {str(e)}'
        }), 500


@menus_bp.route('', methods=['GET'])
@tenant_required
def get_menus():
    """获取菜单列表"""
    try:
        # 获取查询参数
        tree = request.args.get('tree', False, type=bool)
        parent_id = request.args.get('parent_id', type=int)
        
        if tree:
            # 获取菜单树
            menus = menu_service.get_menu_tree()
            return jsonify({
                'success': True,
                'data': {
                    'menus': menus
                }
            })
        elif parent_id is not None:
            # 获取指定父菜单的子菜单
            menus = menu_service.get_menu_children(parent_id)
            return jsonify({
                'code': 200,
                'message': '获取子菜单成功',
                'data': {
                    'menus': menus
                }
            })
        else:
            # 获取所有菜单（平铺列表）
            menus = menu_service.get_all_menus()
            return jsonify({
                'code': 200,
                'message': '获取菜单列表成功',
                'data': {
                    'menus': menus,
                    'total': len(menus)
                }
            })
            
    except Exception as e:
        logger.error(f"Get menus error: {e}")
        return jsonify({
            'code': 500,
            'message': f'获取菜单列表失败: {str(e)}'
        }), 500


@menus_bp.route('/<int:menu_id>', methods=['GET'])
@tenant_required
def get_menu(menu_id):
    """获取单个菜单详情"""
    try:
        menu = menu_service.get_menu_by_id(menu_id)
        if not menu:
            return jsonify({
                'code': 404,
                'message': '菜单不存在'
            }), 404
        
        return jsonify({
            'code': 200,
            'message': '获取菜单详情成功',
            'data': menu
        })
        
    except Exception as e:
        logger.error(f"Get menu error: {e}")
        return jsonify({
            'code': 500,
            'message': f'获取菜单详情失败: {str(e)}'
        }), 500


@menus_bp.route('', methods=['POST'])
@tenant_required
def create_menu():
    """创建菜单 - 已禁用，菜单结构已固定"""
    return jsonify({
        'success': False,
        'message': '菜单结构已固定，不允许创建新菜单'
    }), 403


@menus_bp.route('/<int:menu_id>', methods=['PUT'])
@tenant_required
def update_menu(menu_id):
    """更新菜单 - 已禁用，菜单结构已固定"""
    return jsonify({
        'success': False,
        'message': '菜单结构已固定，不允许修改菜单'
    }), 403


@menus_bp.route('/<int:menu_id>/delete', methods=['POST'])
@tenant_required
def delete_menu(menu_id):
    """删除菜单 - 已禁用，菜单结构已固定"""
    return jsonify({
        'success': False,
        'message': '菜单结构已固定，不允许删除菜单'
    }), 403


@menus_bp.route('/order', methods=['PUT'])
@tenant_required
def update_menu_order():
    """批量更新菜单排序 - 已禁用，菜单结构已固定"""
    return jsonify({
        'success': False,
        'message': '菜单结构已固定，不允许调整菜单顺序'
    }), 403


@menus_bp.route('/<int:menu_id>/toggle-status', methods=['POST'])
@tenant_required
def toggle_menu_status(menu_id):
    """切换菜单状态 - 已禁用，菜单结构已固定"""
    return jsonify({
        'success': False,
        'message': '菜单结构已固定，不允许修改菜单状态'
    }), 403
"""
菜单服务
"""
import logging
from flask import g
from sqlalchemy.exc import IntegrityError
from app.models.menu import Menu
from app.extensions import db

logger = logging.getLogger(__name__)


class MenuService:
    """菜单服务类"""
    
    def get_menu_tree(self):
        """获取菜单树"""
        try:
            return Menu.get_menu_tree(g.tenant_id)
        except Exception as e:
            logger.error(f"Get menu tree error: {e}")
            raise
    
    def get_user_menus(self, user_id):
        """获取用户有权限访问的菜单"""
        try:
            # 目前简单实现：返回所有启用的菜单
            # 后续可以根据用户角色权限进行过滤
            return Menu.get_menu_tree(g.tenant_id)
        except Exception as e:
            logger.error(f"Get user menus error: {e}")
            raise
    
    def get_all_menus(self):
        """获取所有菜单（平铺列表）"""
        try:
            menus = Menu.query_by_tenant().order_by(Menu.sort_order, Menu.created_at).all()
            return [menu.to_dict() for menu in menus]
        except Exception as e:
            logger.error(f"Get all menus error: {e}")
            raise
    
    def get_menu_by_id(self, menu_id):
        """根据ID获取菜单"""
        try:
            menu = Menu.get_by_tenant(menu_id)
            if not menu:
                return None
            return menu.to_dict()
        except Exception as e:
            logger.error(f"Get menu by id error: {e}")
            raise
    
    def create_menu(self, menu_data):
        """创建菜单"""
        try:
            # 验证必填字段
            if not menu_data.get('name'):
                raise ValueError('菜单名称不能为空')
            
            # 验证父菜单是否存在
            parent_id = menu_data.get('parent_id')
            if parent_id:
                parent_menu = Menu.get_by_tenant(parent_id)
                if not parent_menu:
                    raise ValueError('父菜单不存在')
            
            # 检查同级菜单名称是否重复
            existing_menu = Menu.query_by_tenant().filter(
                Menu.name == menu_data['name'],
                Menu.parent_id == parent_id
            ).first()
            if existing_menu:
                raise ValueError('同级菜单名称不能重复')
            
            # 创建菜单
            menu = Menu(
                parent_id=parent_id,
                name=menu_data['name'],
                path=menu_data.get('path', ''),
                component=menu_data.get('component', ''),
                icon=menu_data.get('icon', ''),
                sort_order=menu_data.get('sort_order', 0),
                status=menu_data.get('status', 1),
                tenant_id=g.tenant_id
            )
            
            db.session.add(menu)
            db.session.commit()
            
            return menu.to_dict()
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Create menu integrity error: {e}")
            raise ValueError('菜单创建失败，数据冲突')
        except Exception as e:
            db.session.rollback()
            logger.error(f"Create menu error: {e}")
            raise
    
    def update_menu(self, menu_id, menu_data):
        """更新菜单"""
        try:
            menu = Menu.get_by_tenant(menu_id)
            if not menu:
                raise ValueError('菜单不存在')
            
            # 验证父菜单
            parent_id = menu_data.get('parent_id')
            if parent_id:
                # 不能将菜单设置为自己的子菜单
                if parent_id == menu_id:
                    raise ValueError('不能将菜单设置为自己的父菜单')
                
                # 检查是否会形成循环引用
                if self._would_create_cycle(menu_id, parent_id):
                    raise ValueError('不能形成循环引用')
                
                # 验证父菜单是否存在
                parent_menu = Menu.get_by_tenant(parent_id)
                if not parent_menu:
                    raise ValueError('父菜单不存在')
            
            # 检查同级菜单名称是否重复
            if 'name' in menu_data:
                existing_menu = Menu.query_by_tenant().filter(
                    Menu.name == menu_data['name'],
                    Menu.parent_id == parent_id,
                    Menu.id != menu_id
                ).first()
                if existing_menu:
                    raise ValueError('同级菜单名称不能重复')
            
            # 更新菜单字段
            if 'parent_id' in menu_data:
                menu.parent_id = parent_id
            if 'name' in menu_data:
                menu.name = menu_data['name']
            if 'path' in menu_data:
                menu.path = menu_data['path']
            if 'component' in menu_data:
                menu.component = menu_data['component']
            if 'icon' in menu_data:
                menu.icon = menu_data['icon']
            if 'sort_order' in menu_data:
                menu.sort_order = menu_data['sort_order']
            if 'status' in menu_data:
                menu.status = menu_data['status']
            
            db.session.commit()
            
            return menu.to_dict()
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Update menu integrity error: {e}")
            raise ValueError('菜单更新失败，数据冲突')
        except Exception as e:
            db.session.rollback()
            logger.error(f"Update menu error: {e}")
            raise
    
    def delete_menu(self, menu_id):
        """删除菜单"""
        try:
            menu = Menu.get_by_tenant(menu_id)
            if not menu:
                raise ValueError('菜单不存在')
            
            # 检查是否有子菜单
            children_count = Menu.query_by_tenant().filter_by(parent_id=menu_id).count()
            if children_count > 0:
                raise ValueError(f'该菜单下有 {children_count} 个子菜单，请先删除子菜单')
            
            # 删除菜单
            db.session.delete(menu)
            db.session.commit()
            
            return True
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Delete menu error: {e}")
            raise
    
    def update_menu_order(self, menu_orders):
        """批量更新菜单排序"""
        try:
            for order_data in menu_orders:
                menu_id = order_data.get('id')
                sort_order = order_data.get('sort_order')
                parent_id = order_data.get('parent_id')
                
                if not menu_id:
                    continue
                
                menu = Menu.get_by_tenant(menu_id)
                if menu:
                    menu.sort_order = sort_order
                    if parent_id is not None:
                        menu.parent_id = parent_id
            
            db.session.commit()
            return True
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Update menu order error: {e}")
            raise
    
    def get_menu_children(self, menu_id):
        """获取菜单的直接子菜单"""
        try:
            if menu_id:
                # 验证父菜单是否存在
                parent_menu = Menu.get_by_tenant(menu_id)
                if not parent_menu:
                    raise ValueError('父菜单不存在')
                
                children = Menu.query_by_tenant().filter_by(parent_id=menu_id).order_by(Menu.sort_order).all()
            else:
                # 获取根菜单
                children = Menu.query_by_tenant().filter_by(parent_id=None).order_by(Menu.sort_order).all()
            
            return [child.to_dict() for child in children]
            
        except Exception as e:
            logger.error(f"Get menu children error: {e}")
            raise
    
    def get_parent_menus(self):
        """获取可作为父菜单的菜单列表"""
        try:
            # 获取所有菜单，用于构建父菜单选择列表
            menus = Menu.query_by_tenant().filter_by(status=1).order_by(Menu.sort_order).all()
            
            # 构建层级结构的菜单列表
            menu_list = []
            
            def build_menu_list(parent_id=None, level=0):
                for menu in menus:
                    if menu.parent_id == parent_id:
                        menu_dict = menu.to_dict()
                        menu_dict['level'] = level
                        menu_dict['display_name'] = '　' * level + menu.name
                        menu_list.append(menu_dict)
                        build_menu_list(menu.id, level + 1)
            
            build_menu_list()
            return menu_list
            
        except Exception as e:
            logger.error(f"Get parent menus error: {e}")
            raise
    
    def _would_create_cycle(self, menu_id, parent_id):
        """检查是否会形成循环引用"""
        try:
            current_id = parent_id
            visited = set()
            
            while current_id:
                if current_id == menu_id:
                    return True
                
                if current_id in visited:
                    # 检测到循环，但不是我们要检查的循环
                    break
                
                visited.add(current_id)
                
                # 获取当前菜单的父菜单
                current_menu = Menu.get_by_tenant(current_id)
                if not current_menu:
                    break
                
                current_id = current_menu.parent_id
            
            return False
            
        except Exception as e:
            logger.error(f"Check cycle error: {e}")
            return True  # 出错时保守处理，认为会形成循环
    
    def toggle_menu_status(self, menu_id):
        """切换菜单状态"""
        try:
            menu = Menu.get_by_tenant(menu_id)
            if not menu:
                raise ValueError('菜单不存在')
            
            # 切换状态
            menu.status = 1 if menu.status == 0 else 0
            
            # 如果禁用菜单，同时禁用所有子菜单
            if menu.status == 0:
                self._disable_children_recursive(menu_id)
            
            db.session.commit()
            
            return menu.to_dict()
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Toggle menu status error: {e}")
            raise
    
    def _disable_children_recursive(self, parent_id):
        """递归禁用所有子菜单"""
        try:
            children = Menu.query_by_tenant().filter_by(parent_id=parent_id).all()
            for child in children:
                child.status = 0
                self._disable_children_recursive(child.id)
        except Exception as e:
            logger.error(f"Disable children recursive error: {e}")
            raise


# 创建全局菜单服务实例
menu_service = MenuService()
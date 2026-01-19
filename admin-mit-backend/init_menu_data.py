#!/usr/bin/env python3
"""
初始化菜单数据脚本
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db
from app.models.menu import Menu
from app.models.tenant import Tenant

def init_menu_data():
    """初始化菜单数据"""
    app = create_app()
    
    with app.app_context():
        try:
            # 获取第一个租户
            tenant = Tenant.query.first()
            if not tenant:
                print("❌ 没有找到租户，请先创建租户")
                return
            
            print(f"✓ 找到租户: {tenant.name} (ID: {tenant.id})")
            
            # 检查是否已有菜单数据
            existing_menus = Menu.query.filter_by(tenant_id=tenant.id).count()
            if existing_menus > 0:
                print(f"✓ 已存在 {existing_menus} 个菜单，跳过初始化")
                return
            
            # 创建默认菜单数据
            menus_data = [
                {
                    'name': '仪表盘',
                    'path': '/dashboard',
                    'component': 'Dashboard',
                    'icon': 'LayoutDashboard',
                    'sort_order': 1,
                    'status': 1
                },
                {
                    'name': '系统管理',
                    'path': '/system',
                    'icon': 'Settings',
                    'sort_order': 2,
                    'status': 1,
                    'children': [
                        {
                            'name': '用户管理',
                            'path': '/users',
                            'component': 'Users',
                            'icon': 'Users',
                            'sort_order': 1,
                            'status': 1
                        },
                        {
                            'name': '角色管理',
                            'path': '/roles',
                            'component': 'Roles',
                            'icon': 'Shield',
                            'sort_order': 2,
                            'status': 1
                        },
                        {
                            'name': '菜单管理',
                            'path': '/menus',
                            'component': 'Menus',
                            'icon': 'Menu',
                            'sort_order': 3,
                            'status': 1
                        },
                        {
                            'name': '权限说明',
                            'path': '/permissions-guide',
                            'component': 'PermissionsGuide',
                            'icon': 'Info',
                            'sort_order': 4,
                            'status': 1
                        }
                    ]
                },
                {
                    'name': '主机管理',
                    'path': '/hosts',
                    'component': 'Hosts',
                    'icon': 'Server',
                    'sort_order': 3,
                    'status': 1
                },
                {
                    'name': 'Ansible',
                    'path': '/ansible',
                    'component': 'Ansible',
                    'icon': 'Zap',
                    'sort_order': 4,
                    'status': 1
                },
                {
                    'name': '监控告警',
                    'path': '/monitor',
                    'component': 'Monitor',
                    'icon': 'Monitor',
                    'sort_order': 5,
                    'status': 1
                },
                {
                    'name': '网络探测',
                    'path': '/network',
                    'component': 'Network',
                    'icon': 'Network',
                    'sort_order': 6,
                    'status': 1
                },
                {
                    'name': '运维审计',
                    'path': '/audit',
                    'icon': 'Shield',
                    'sort_order': 7,
                    'status': 1,
                    'children': [
                        {
                            'name': '操作日志',
                            'path': '/audit/operations',
                            'component': 'Audit/OperationLogs',
                            'icon': 'FileText',
                            'sort_order': 1,
                            'status': 1
                        },
                        {
                            'name': '主机审计',
                            'path': '/audit/hosts',
                            'component': 'Audit/HostAudit',
                            'icon': 'Terminal',
                            'sort_order': 2,
                            'status': 1
                        }
                    ]
                }
            ]
            
            def create_menu(menu_data, parent_id=None):
                """递归创建菜单"""
                menu = Menu(
                    tenant_id=tenant.id,
                    parent_id=parent_id,
                    name=menu_data['name'],
                    path=menu_data.get('path'),
                    component=menu_data.get('component'),
                    icon=menu_data.get('icon'),
                    sort_order=menu_data.get('sort_order', 0),
                    status=menu_data.get('status', 1)
                )
                
                db.session.add(menu)
                db.session.flush()  # 获取 ID
                
                print(f"✓ 创建菜单: {menu.name} (ID: {menu.id})")
                
                # 创建子菜单
                if 'children' in menu_data:
                    for child_data in menu_data['children']:
                        create_menu(child_data, menu.id)
                
                return menu
            
            # 创建所有菜单
            for menu_data in menus_data:
                create_menu(menu_data)
            
            db.session.commit()
            
            # 验证结果
            total_menus = Menu.query.filter_by(tenant_id=tenant.id).count()
            print(f"\n✅ 菜单数据初始化完成！共创建 {total_menus} 个菜单")
            
            # 显示菜单树
            print("\n📋 菜单树结构:")
            tree = Menu.get_menu_tree(tenant.id)
            print_menu_tree(tree)
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ 初始化菜单数据失败: {e}")
            import traceback
            traceback.print_exc()

def print_menu_tree(menus, level=0):
    """打印菜单树"""
    for menu in menus:
        indent = "  " * level
        print(f"{indent}├─ {menu['name']} ({menu['path'] or 'N/A'})")
        if menu.get('children'):
            print_menu_tree(menu['children'], level + 1)

if __name__ == '__main__':
    init_menu_data()
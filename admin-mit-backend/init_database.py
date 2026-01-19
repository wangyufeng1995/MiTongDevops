#!/usr/bin/env python3
"""
数据库初始化脚本
创建示例租户、用户、角色、菜单数据和默认网络探测分组
"""
import os
import sys
from datetime import datetime

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app
from app.extensions import db
from app.models import (
    Tenant, User, Role, UserRole, Menu, 
    NetworkProbeGroup
)


def init_database():
    """初始化数据库"""
    app = create_app()
    
    with app.app_context():
        # 创建所有表
        db.create_all()
        
        # 创建示例数据
        create_sample_data()
        
        print("数据库初始化完成！")


def create_sample_data():
    """创建示例数据"""
    # 创建示例租户
    tenant = Tenant(
        name="示例企业",
        code="demo_company",
        status=1
    )
    db.session.add(tenant)
    db.session.flush()  # 获取 tenant.id
    
    # 创建超级管理员角色
    super_admin_role = Role(
        tenant_id=tenant.id,
        name="super_admin",
        description="超级管理员，拥有所有权限",
        permissions=[
            "user:read", "user:create", "user:update", "user:delete",
            "role:read", "role:create", "role:update", "role:delete",
            "menu:read", "menu:create", "menu:update", "menu:delete",
            "host:read", "host:create", "host:update", "host:delete",
            "ansible:read", "ansible:create", "ansible:update", "ansible:delete",
            "monitor:read", "monitor:create", "monitor:update", "monitor:delete",
            "network:read", "network:create", "network:update", "network:delete",
            "log:read"
        ]
    )
    db.session.add(super_admin_role)
    
    # 创建管理员角色
    admin_role = Role(
        tenant_id=tenant.id,
        name="admin",
        description="管理员，拥有大部分权限",
        permissions=[
            "user:read", "user:create", "user:update",
            "role:read",
            "menu:read",
            "host:read", "host:create", "host:update", "host:delete",
            "ansible:read", "ansible:create", "ansible:update", "ansible:delete",
            "monitor:read", "monitor:create", "monitor:update", "monitor:delete",
            "network:read", "network:create", "network:update", "network:delete",
            "log:read"
        ]
    )
    db.session.add(admin_role)
    
    # 创建普通用户角色
    user_role = Role(
        tenant_id=tenant.id,
        name="普通用户",
        description="普通用户，拥有基本查看权限",
        permissions=[
            "user:read", "host:read", "ansible:read", 
            "monitor:read", "network:read", "log:read"
        ]
    )
    db.session.add(user_role)
    db.session.flush()  # 获取角色 ID
    
    # 创建管理员用户
    admin_user = User(
        tenant_id=tenant.id,
        username="admin",
        email="admin@example.com",
        full_name="系统管理员",
        avatar_style="avataaars",
        avatar_seed="admin",
        avatar_config={
            "backgroundColor": "b6e3f4",
            "topType": "ShortHairShortFlat",
            "accessoriesType": "Blank",
            "hairColor": "BrownDark",
            "facialHairType": "Blank",
            "clotheType": "BlazerShirt",
            "eyeType": "Default",
            "eyebrowType": "Default",
            "mouthType": "Default",
            "skinColor": "Light"
        },
        status=1
    )
    admin_user.set_password("admin123")
    db.session.add(admin_user)
    
    # 创建普通用户
    normal_user = User(
        tenant_id=tenant.id,
        username="user",
        email="user@example.com",
        full_name="普通用户",
        avatar_style="avataaars",
        avatar_seed="user",
        avatar_config={
            "backgroundColor": "c0aede",
            "topType": "LongHairStraight",
            "accessoriesType": "Blank",
            "hairColor": "Blonde",
            "facialHairType": "Blank",
            "clotheType": "BlazerSweater",
            "eyeType": "Default",
            "eyebrowType": "Default",
            "mouthType": "Default",
            "skinColor": "Light"
        },
        status=1
    )
    normal_user.set_password("user123")
    db.session.add(normal_user)
    db.session.flush()  # 获取用户 ID
    
    # 分配角色
    admin_user_role = UserRole(user_id=admin_user.id, role_id=super_admin_role.id)
    normal_user_role = UserRole(user_id=normal_user.id, role_id=user_role.id)
    db.session.add(admin_user_role)
    db.session.add(normal_user_role)
    
    # 创建菜单
    create_menus(tenant.id)
    
    # 创建默认网络探测分组
    create_default_network_group(tenant.id, admin_user.id)
    
    # 提交所有更改
    db.session.commit()
    
    print(f"创建租户: {tenant.name} (code: {tenant.code})")
    print(f"创建管理员用户: {admin_user.username} (密码: admin123)")
    print(f"创建普通用户: {normal_user.username} (密码: user123)")
    print("创建示例菜单和默认网络探测分组")


def create_menus(tenant_id):
    """创建示例菜单"""
    menus = [
        # 仪表盘
        {
            "name": "仪表盘",
            "path": "/dashboard",
            "component": "Dashboard",
            "icon": "dashboard",
            "sort_order": 1
        },
        # 用户管理
        {
            "name": "用户管理",
            "path": "/users",
            "component": "Users",
            "icon": "user",
            "sort_order": 2
        },
        # 角色管理
        {
            "name": "角色管理",
            "path": "/roles",
            "component": "Roles",
            "icon": "team",
            "sort_order": 3
        },
        # 菜单管理
        {
            "name": "菜单管理",
            "path": "/menus",
            "component": "Menus",
            "icon": "menu",
            "sort_order": 4
        },
        # 主机运维
        {
            "name": "主机运维",
            "path": "/devops",
            "icon": "server",
            "sort_order": 5,
            "children": [
                {
                    "name": "SSH 主机",
                    "path": "/devops/hosts",
                    "component": "DevOps/Hosts",
                    "icon": "desktop",
                    "sort_order": 1
                },
                {
                    "name": "Web 终端",
                    "path": "/devops/webshell",
                    "component": "DevOps/WebShell",
                    "icon": "code",
                    "sort_order": 2
                },
                {
                    "name": "Ansible 管理",
                    "path": "/devops/ansible",
                    "component": "DevOps/Ansible",
                    "icon": "play-circle",
                    "sort_order": 3
                }
            ]
        },
        # 监控告警
        {
            "name": "监控告警",
            "path": "/monitor",
            "icon": "alert",
            "sort_order": 6,
            "children": [
                {
                    "name": "告警渠道",
                    "path": "/monitor/channels",
                    "component": "Monitor/Channels",
                    "icon": "notification",
                    "sort_order": 1
                },
                {
                    "name": "告警规则",
                    "path": "/monitor/rules",
                    "component": "Monitor/Rules",
                    "icon": "setting",
                    "sort_order": 2
                },
                {
                    "name": "告警历史",
                    "path": "/monitor/history",
                    "component": "Monitor/History",
                    "icon": "history",
                    "sort_order": 3
                },
                {
                    "name": "监控大屏",
                    "path": "/monitor/dashboard",
                    "component": "Monitor/Dashboard",
                    "icon": "dashboard",
                    "sort_order": 4
                }
            ]
        },
        # 网络运维
        {
            "name": "网络运维",
            "path": "/network",
            "icon": "global",
            "sort_order": 7,
            "children": [
                {
                    "name": "探测分组",
                    "path": "/network/groups",
                    "component": "Network/Groups",
                    "icon": "folder",
                    "sort_order": 1
                },
                {
                    "name": "网络探测",
                    "path": "/network/probes",
                    "component": "Network/Probes",
                    "icon": "radar-chart",
                    "sort_order": 2
                },
                {
                    "name": "探测监控",
                    "path": "/network/monitor",
                    "component": "Network/Monitor",
                    "icon": "line-chart",
                    "sort_order": 3
                },
                {
                    "name": "探测告警",
                    "path": "/network/alerts",
                    "component": "Network/Alerts",
                    "icon": "warning",
                    "sort_order": 4
                }
            ]
        },
        # 操作日志
        {
            "name": "操作日志",
            "path": "/logs",
            "component": "Logs",
            "icon": "file-text",
            "sort_order": 8
        }
    ]
    
    def create_menu_recursive(menu_data, parent_id=None):
        menu = Menu(
            tenant_id=tenant_id,
            parent_id=parent_id,
            name=menu_data["name"],
            path=menu_data.get("path"),
            component=menu_data.get("component"),
            icon=menu_data.get("icon"),
            sort_order=menu_data.get("sort_order", 0),
            status=1
        )
        db.session.add(menu)
        db.session.flush()  # 获取菜单 ID
        
        # 创建子菜单
        if "children" in menu_data:
            for child_data in menu_data["children"]:
                create_menu_recursive(child_data, menu.id)
    
    for menu_data in menus:
        create_menu_recursive(menu_data)


def create_default_network_group(tenant_id, user_id):
    """创建默认网络探测分组"""
    default_group = NetworkProbeGroup(
        tenant_id=tenant_id,
        name="未分组",
        description="系统默认分组，用于未指定分组的探测目标",
        is_default=True,
        is_system=True,
        color="#999999",
        sort_order=999,
        created_by=user_id
    )
    db.session.add(default_group)


if __name__ == "__main__":
    init_database()
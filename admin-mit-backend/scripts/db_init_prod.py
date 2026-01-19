#!/usr/bin/env python3
"""
生产环境数据库初始化脚本
创建必要的数据库结构和初始数据
"""
import sys
import os
from pathlib import Path

# 添加项目根目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app
from app.extensions import db
from app.models import Tenant, User, Role, Menu
from werkzeug.security import generate_password_hash
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_database():
    """初始化数据库"""
    app = create_app()
    
    with app.app_context():
        logger.info("开始初始化数据库...")
        
        # 创建所有表
        logger.info("创建数据库表...")
        db.create_all()
        logger.info("✓ 数据库表创建完成")
        
        # 检查是否已有数据
        if Tenant.query.first():
            logger.warning("数据库已包含数据，跳过初始化")
            return
        
        # 创建默认租户
        logger.info("创建默认租户...")
        tenant = Tenant(
            name="默认租户",
            code="default",
            status=1
        )
        db.session.add(tenant)
        db.session.flush()
        logger.info(f"✓ 创建租户: {tenant.name} (ID: {tenant.id})")
        
        # 创建管理员角色
        logger.info("创建管理员角色...")
        admin_role = Role(
            tenant_id=tenant.id,
            name="超级管理员",
            description="系统超级管理员，拥有所有权限",
            permissions={"all": True}
        )
        db.session.add(admin_role)
        db.session.flush()
        logger.info(f"✓ 创建角色: {admin_role.name} (ID: {admin_role.id})")
        
        # 创建管理员用户
        logger.info("创建管理员用户...")
        admin_password = os.environ.get('ADMIN_PASSWORD', 'Admin@123456')
        admin_user = User(
            tenant_id=tenant.id,
            username="admin",
            email="admin@example.com",
            password_hash=generate_password_hash(admin_password),
            full_name="系统管理员",
            status=1
        )
        db.session.add(admin_user)
        db.session.flush()
        logger.info(f"✓ 创建用户: {admin_user.username} (ID: {admin_user.id})")
        
        # 关联用户和角色
        admin_user.roles.append(admin_role)
        
        # 创建默认菜单
        logger.info("创建默认菜单...")
        menus = [
            {
                "name": "仪表盘",
                "path": "/dashboard",
                "icon": "dashboard",
                "sort_order": 1
            },
            {
                "name": "系统管理",
                "path": "/system",
                "icon": "setting",
                "sort_order": 2,
                "children": [
                    {"name": "用户管理", "path": "/system/users", "icon": "user"},
                    {"name": "角色管理", "path": "/system/roles", "icon": "team"},
                    {"name": "菜单管理", "path": "/system/menus", "icon": "menu"},
                    {"name": "操作日志", "path": "/system/logs", "icon": "file-text"},
                ]
            },
            {
                "name": "主机运维",
                "path": "/devops",
                "icon": "cloud-server",
                "sort_order": 3,
                "children": [
                    {"name": "主机管理", "path": "/devops/hosts", "icon": "server"},
                    {"name": "WebShell", "path": "/devops/webshell", "icon": "code"},
                    {"name": "Ansible", "path": "/devops/ansible", "icon": "robot"},
                ]
            },
            {
                "name": "监控告警",
                "path": "/monitor",
                "icon": "alert",
                "sort_order": 4,
                "children": [
                    {"name": "告警渠道", "path": "/monitor/channels", "icon": "notification"},
                    {"name": "告警规则", "path": "/monitor/rules", "icon": "control"},
                    {"name": "告警历史", "path": "/monitor/history", "icon": "history"},
                    {"name": "监控大屏", "path": "/monitor/dashboard", "icon": "dashboard"},
                ]
            },
            {
                "name": "网络运维",
                "path": "/network",
                "icon": "global",
                "sort_order": 5,
                "children": [
                    {"name": "探测分组", "path": "/network/groups", "icon": "folder"},
                    {"name": "网络探测", "path": "/network/probes", "icon": "radar-chart"},
                    {"name": "探测监控", "path": "/network/monitor", "icon": "line-chart"},
                    {"name": "探测告警", "path": "/network/alerts", "icon": "bell"},
                ]
            },
        ]
        
        def create_menu(menu_data, parent_id=None):
            """递归创建菜单"""
            menu = Menu(
                tenant_id=tenant.id,
                parent_id=parent_id,
                name=menu_data["name"],
                path=menu_data.get("path"),
                icon=menu_data.get("icon"),
                sort_order=menu_data.get("sort_order", 0),
                status=1
            )
            db.session.add(menu)
            db.session.flush()
            
            # 创建子菜单
            if "children" in menu_data:
                for child_data in menu_data["children"]:
                    create_menu(child_data, menu.id)
            
            return menu
        
        for menu_data in menus:
            create_menu(menu_data)
        
        logger.info("✓ 默认菜单创建完成")
        
        # 提交事务
        db.session.commit()
        logger.info("✓ 数据库初始化完成")
        
        # 输出管理员信息
        print("\n" + "=" * 60)
        print("数据库初始化成功！")
        print("=" * 60)
        print(f"租户: {tenant.name}")
        print(f"管理员用户名: {admin_user.username}")
        print(f"管理员密码: {admin_password}")
        print("=" * 60)
        print("⚠️  请立即修改管理员密码！")
        print("=" * 60)

if __name__ == '__main__':
    try:
        init_database()
    except Exception as e:
        logger.error(f"数据库初始化失败: {str(e)}")
        sys.exit(1)

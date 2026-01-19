"""
角色服务
"""
import logging
from flask import g
from sqlalchemy.exc import IntegrityError
from app.models.role import Role, UserRole
from app.extensions import db

logger = logging.getLogger(__name__)


class RoleService:
    """角色服务类"""
    
    def get_roles_paginated(self, page=1, per_page=10, search=''):
        """获取分页角色列表"""
        try:
            # 构建查询
            query = Role.query_by_tenant()
            
            # 搜索过滤
            if search:
                query = query.filter(
                    db.or_(
                        Role.name.contains(search),
                        Role.description.contains(search)
                    )
                )
            
            # 按创建时间倒序排列
            query = query.order_by(Role.created_at.desc())
            
            # 分页
            pagination = query.paginate(
                page=page, 
                per_page=per_page, 
                error_out=False
            )
            
            return {
                'roles': [role.to_dict() for role in pagination.items],
                'pagination': {
                    'page': page,
                    'per_page': per_page,
                    'total': pagination.total,
                    'pages': pagination.pages,
                    'has_prev': pagination.has_prev,
                    'has_next': pagination.has_next
                }
            }
            
        except Exception as e:
            logger.error(f"Get roles paginated error: {e}")
            raise
    
    def get_all_roles(self):
        """获取所有角色（不分页）"""
        try:
            roles = Role.query_by_tenant().order_by(Role.name).all()
            return [role.to_dict() for role in roles]
        except Exception as e:
            logger.error(f"Get all roles error: {e}")
            raise
    
    def get_role_by_id(self, role_id):
        """根据ID获取角色"""
        try:
            role = Role.get_by_tenant(role_id)
            if not role:
                return None
            return role.to_dict()
        except Exception as e:
            logger.error(f"Get role by id error: {e}")
            raise
    
    def create_role(self, role_data):
        """创建角色"""
        try:
            # 验证必填字段
            if not role_data.get('name'):
                raise ValueError('角色名称不能为空')
            
            # 检查角色名称是否已存在
            existing_role = Role.query_by_tenant().filter_by(name=role_data['name']).first()
            if existing_role:
                raise ValueError('角色名称已存在')
            
            # 创建角色
            role = Role(
                name=role_data['name'],
                description=role_data.get('description', ''),
                permissions=role_data.get('permissions', []),
                status=role_data.get('status', 1),  # 默认启用
                tenant_id=g.tenant_id
            )
            
            db.session.add(role)
            db.session.commit()
            
            return role.to_dict()
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Create role integrity error: {e}")
            raise ValueError('角色创建失败，数据冲突')
        except Exception as e:
            db.session.rollback()
            logger.error(f"Create role error: {e}")
            raise
    
    def update_role(self, role_id, role_data):
        """更新角色"""
        try:
            role = Role.get_by_tenant(role_id)
            if not role:
                raise ValueError('角色不存在')
            
            # 更新角色名称
            if 'name' in role_data:
                # 检查角色名称是否已被其他角色使用
                existing_role = Role.query_by_tenant().filter(
                    Role.name == role_data['name'],
                    Role.id != role_id
                ).first()
                if existing_role:
                    raise ValueError('角色名称已被其他角色使用')
                role.name = role_data['name']
            
            # 更新描述
            if 'description' in role_data:
                role.description = role_data['description']
            
            # 更新权限
            if 'permissions' in role_data:
                role.permissions = role_data['permissions']
            
            # 更新状态
            if 'status' in role_data:
                role.status = role_data['status']
            
            db.session.commit()
            
            return role.to_dict()
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Update role integrity error: {e}")
            raise ValueError('角色更新失败，数据冲突')
        except Exception as e:
            db.session.rollback()
            logger.error(f"Update role error: {e}")
            raise
    
    def delete_role(self, role_id):
        """删除角色"""
        try:
            role = Role.get_by_tenant(role_id)
            if not role:
                raise ValueError('角色不存在')
            
            # 检查是否有用户使用该角色
            user_count = UserRole.query.filter_by(role_id=role_id).count()
            if user_count > 0:
                raise ValueError(f'该角色正在被 {user_count} 个用户使用，无法删除')
            
            # 删除角色
            db.session.delete(role)
            db.session.commit()
            
            return True
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Delete role error: {e}")
            raise
    
    def get_role_permissions(self, role_id):
        """获取角色权限"""
        try:
            role = Role.get_by_tenant(role_id)
            if not role:
                raise ValueError('角色不存在')
            
            return role.permissions or []
            
        except Exception as e:
            logger.error(f"Get role permissions error: {e}")
            raise
    
    def update_role_permissions(self, role_id, permissions):
        """更新角色权限"""
        try:
            role = Role.get_by_tenant(role_id)
            if not role:
                raise ValueError('角色不存在')
            
            role.permissions = permissions
            db.session.commit()
            
            return role.to_dict()
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Update role permissions error: {e}")
            raise
    
    def get_role_users(self, role_id):
        """获取角色关联的用户列表"""
        try:
            role = Role.get_by_tenant(role_id)
            if not role:
                raise ValueError('角色不存在')
            
            # 获取使用该角色的用户
            user_roles = UserRole.query.filter_by(role_id=role_id).all()
            users = []
            
            for user_role in user_roles:
                user = user_role.user
                # 确保用户属于当前租户
                if user.tenant_id == g.tenant_id:
                    users.append({
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'full_name': user.full_name,
                        'assigned_at': user_role.created_at.isoformat() if user_role.created_at else None
                    })
            
            return users
            
        except Exception as e:
            logger.error(f"Get role users error: {e}")
            raise
    
    def get_available_permissions(self):
        """获取可用权限列表"""
        try:
            # 定义系统可用的权限
            permissions = [
                {
                    'module': 'user',
                    'name': '用户管理',
                    'permissions': [
                        {'key': 'user:view', 'name': '查看用户'},
                        {'key': 'user:create', 'name': '创建用户'},
                        {'key': 'user:update', 'name': '编辑用户'},
                        {'key': 'user:delete', 'name': '删除用户'},
                    ]
                },
                {
                    'module': 'role',
                    'name': '角色管理',
                    'permissions': [
                        {'key': 'role:view', 'name': '查看角色'},
                        {'key': 'role:create', 'name': '创建角色'},
                        {'key': 'role:update', 'name': '编辑角色'},
                        {'key': 'role:delete', 'name': '删除角色'},
                    ]
                },
                {
                    'module': 'menu',
                    'name': '菜单管理',
                    'permissions': [
                        {'key': 'menu:view', 'name': '查看菜单'},
                        {'key': 'menu:create', 'name': '创建菜单'},
                        {'key': 'menu:update', 'name': '编辑菜单'},
                        {'key': 'menu:delete', 'name': '删除菜单'},
                    ]
                },
                {
                    'module': 'log',
                    'name': '日志管理',
                    'permissions': [
                        {'key': 'log:view', 'name': '查看日志'},
                        {'key': 'log:export', 'name': '导出日志'},
                    ]
                },
                {
                    'module': 'host',
                    'name': '主机管理',
                    'permissions': [
                        {'key': 'host:view', 'name': '查看主机'},
                        {'key': 'host:create', 'name': '添加主机'},
                        {'key': 'host:update', 'name': '编辑主机'},
                        {'key': 'host:delete', 'name': '删除主机'},
                        {'key': 'host:connect', 'name': '连接主机'},
                        {'key': 'host:webshell', 'name': '使用WebShell'},
                    ]
                },
                {
                    'module': 'ansible',
                    'name': 'Ansible管理',
                    'permissions': [
                        {'key': 'ansible:view', 'name': '查看Playbook'},
                        {'key': 'ansible:create', 'name': '创建Playbook'},
                        {'key': 'ansible:update', 'name': '编辑Playbook'},
                        {'key': 'ansible:delete', 'name': '删除Playbook'},
                        {'key': 'ansible:execute', 'name': '执行Playbook'},
                    ]
                },
                {
                    'module': 'monitor',
                    'name': '监控告警',
                    'permissions': [
                        {'key': 'monitor:view', 'name': '查看监控'},
                        {'key': 'monitor:channel', 'name': '管理告警渠道'},
                        {'key': 'monitor:rule', 'name': '管理告警规则'},
                        {'key': 'monitor:alert', 'name': '处理告警'},
                    ]
                },
                {
                    'module': 'network',
                    'name': '网络探测',
                    'permissions': [
                        {'key': 'network:view', 'name': '查看探测'},
                        {'key': 'network:create', 'name': '创建探测'},
                        {'key': 'network:update', 'name': '编辑探测'},
                        {'key': 'network:delete', 'name': '删除探测'},
                        {'key': 'network:execute', 'name': '执行探测'},
                        {'key': 'network:group', 'name': '管理分组'},
                    ]
                }
            ]
            
            return permissions
            
        except Exception as e:
            logger.error(f"Get available permissions error: {e}")
            raise


# 创建全局角色服务实例
role_service = RoleService()
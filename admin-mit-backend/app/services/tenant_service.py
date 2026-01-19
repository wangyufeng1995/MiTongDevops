from flask import g
from app.models.tenant import Tenant
from app.models.user import User
from app.models.role import Role, UserRole
from app.extensions import db
from sqlalchemy.exc import IntegrityError
import logging

logger = logging.getLogger(__name__)

class TenantService:
    """租户服务类"""
    
    @staticmethod
    def create_tenant(name: str, code: str, admin_user_data: dict = None) -> dict:
        """
        创建租户
        
        Args:
            name: 租户名称
            code: 租户代码
            admin_user_data: 管理员用户数据
            
        Returns:
            dict: 创建结果
        """
        try:
            # 检查租户代码是否已存在
            existing_tenant = Tenant.query.filter_by(code=code).first()
            if existing_tenant:
                return {
                    'success': False,
                    'message': '租户代码已存在'
                }
            
            # 创建租户
            tenant = Tenant(name=name, code=code)
            db.session.add(tenant)
            db.session.flush()  # 获取租户ID
            
            # 如果提供了管理员用户数据，创建管理员用户
            if admin_user_data:
                # 临时设置租户上下文
                original_tenant_id = getattr(g, 'tenant_id', None)
                g.tenant_id = tenant.id
                
                try:
                    # 创建管理员角色
                    admin_role = Role(
                        name='admin',
                        description='系统管理员',
                        tenant_id=tenant.id
                    )
                    admin_role.set_permissions([
                        'user.create', 'user.read', 'user.update', 'user.delete',
                        'role.create', 'role.read', 'role.update', 'role.delete',
                        'menu.create', 'menu.read', 'menu.update', 'menu.delete',
                        'system.admin'
                    ])
                    db.session.add(admin_role)
                    db.session.flush()
                    
                    # 创建管理员用户
                    admin_user = User(
                        username=admin_user_data['username'],
                        email=admin_user_data['email'],
                        full_name=admin_user_data.get('full_name', '系统管理员'),
                        tenant_id=tenant.id
                    )
                    admin_user.set_password(admin_user_data['password'])
                    db.session.add(admin_user)
                    db.session.flush()
                    
                    # 分配管理员角色
                    user_role = UserRole(user_id=admin_user.id, role_id=admin_role.id)
                    db.session.add(user_role)
                    
                finally:
                    # 恢复原始租户上下文
                    g.tenant_id = original_tenant_id
            
            db.session.commit()
            
            return {
                'success': True,
                'data': {
                    'tenant': tenant.to_dict()
                }
            }
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Tenant creation integrity error: {e}")
            return {
                'success': False,
                'message': '租户创建失败，数据冲突'
            }
        except Exception as e:
            db.session.rollback()
            logger.error(f"Tenant creation error: {e}")
            return {
                'success': False,
                'message': '租户创建失败'
            }
    
    @staticmethod
    def get_tenant_by_code(code: str) -> Tenant:
        """
        根据代码获取租户
        
        Args:
            code: 租户代码
            
        Returns:
            Tenant: 租户对象
        """
        return Tenant.query.filter_by(code=code).first()
    
    @staticmethod
    def get_tenant_stats(tenant_id: int) -> dict:
        """
        获取租户统计信息
        
        Args:
            tenant_id: 租户ID
            
        Returns:
            dict: 统计信息
        """
        try:
            # 临时设置租户上下文
            original_tenant_id = getattr(g, 'tenant_id', None)
            g.tenant_id = tenant_id
            
            try:
                user_count = User.query_by_tenant().count()
                role_count = Role.query_by_tenant().count()
                
                return {
                    'user_count': user_count,
                    'role_count': role_count
                }
            finally:
                # 恢复原始租户上下文
                g.tenant_id = original_tenant_id
                
        except Exception as e:
            logger.error(f"Get tenant stats error: {e}")
            return {
                'user_count': 0,
                'role_count': 0
            }
    
    @staticmethod
    def update_tenant_status(tenant_id: int, status: int) -> dict:
        """
        更新租户状态
        
        Args:
            tenant_id: 租户ID
            status: 状态值
            
        Returns:
            dict: 更新结果
        """
        try:
            tenant = Tenant.query.get(tenant_id)
            if not tenant:
                return {
                    'success': False,
                    'message': '租户不存在'
                }
            
            tenant.status = status
            db.session.commit()
            
            return {
                'success': True,
                'data': {
                    'tenant': tenant.to_dict()
                }
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Update tenant status error: {e}")
            return {
                'success': False,
                'message': '更新租户状态失败'
            }
    
    @staticmethod
    def validate_tenant_access(tenant_id: int, user_tenant_id: int) -> bool:
        """
        验证租户访问权限
        
        Args:
            tenant_id: 要访问的租户ID
            user_tenant_id: 用户所属租户ID
            
        Returns:
            bool: 是否有权限访问
        """
        # 用户只能访问自己所属的租户
        return tenant_id == user_tenant_id
    
    @staticmethod
    def get_current_tenant() -> Tenant:
        """
        获取当前租户
        
        Returns:
            Tenant: 当前租户对象
        """
        tenant_id = getattr(g, 'tenant_id', None)
        if tenant_id:
            return Tenant.query.get(tenant_id)
        return None
    
    @staticmethod
    def switch_tenant_context(tenant_id: int):
        """
        切换租户上下文（仅用于系统内部操作）
        
        Args:
            tenant_id: 租户ID
        """
        g.tenant_id = tenant_id
    
    @staticmethod
    def clear_tenant_context():
        """清除租户上下文"""
        if hasattr(g, 'tenant_id'):
            delattr(g, 'tenant_id')

# 创建全局租户服务实例
tenant_service = TenantService()
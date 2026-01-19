"""
用户服务
"""
import uuid
import logging
from flask import g
from sqlalchemy.exc import IntegrityError
from app.models.user import User
from app.models.role import Role, UserRole
from app.extensions import db

logger = logging.getLogger(__name__)


class UserService:
    """用户服务类"""
    
    def get_users_paginated(self, page=1, per_page=10, search=''):
        """获取分页用户列表"""
        try:
            # 构建查询
            query = User.query_by_tenant()
            
            # 搜索过滤
            if search:
                query = query.filter(
                    db.or_(
                        User.username.contains(search),
                        User.email.contains(search),
                        User.full_name.contains(search)
                    )
                )
            
            # 按创建时间倒序排列
            query = query.order_by(User.created_at.desc())
            
            # 分页
            pagination = query.paginate(
                page=page, 
                per_page=per_page, 
                error_out=False
            )
            
            return {
                'users': [user.to_dict() for user in pagination.items],
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
            logger.error(f"Get users paginated error: {e}")
            raise
    
    def get_user_by_id(self, user_id):
        """根据ID获取用户"""
        try:
            user = User.get_by_tenant(user_id)
            if not user:
                return None
            return user.to_dict()
        except Exception as e:
            logger.error(f"Get user by id error: {e}")
            raise
    
    def create_user(self, user_data):
        """创建用户"""
        try:
            # 验证必填字段
            required_fields = ['username', 'email', 'password']
            for field in required_fields:
                if not user_data.get(field):
                    raise ValueError(f'{field} 不能为空')
            
            # 检查用户名和邮箱是否已存在
            existing_user = User.query.filter(
                db.or_(
                    User.username == user_data['username'],
                    User.email == user_data['email']
                )
            ).first()
            
            if existing_user:
                raise ValueError('用户名或邮箱已存在')
            
            # 创建用户
            user = User(
                username=user_data['username'],
                email=user_data['email'],
                full_name=user_data.get('full_name', ''),
                tenant_id=g.tenant_id
            )
            user.set_password(user_data['password'])
            
            # 设置头像配置
            if 'avatar_style' in user_data:
                user.avatar_style = user_data['avatar_style']
            if 'avatar_seed' in user_data:
                user.avatar_seed = user_data['avatar_seed']
            else:
                # 如果没有提供种子值，生成一个随机的
                user.avatar_seed = str(uuid.uuid4())
            
            if 'avatar_config' in user_data:
                user.set_avatar_config(user_data['avatar_config'])
            
            db.session.add(user)
            db.session.flush()
            
            # 分配角色
            role_ids = user_data.get('role_ids', [])
            self._assign_user_roles(user.id, role_ids)
            
            db.session.commit()
            
            return user.to_dict()
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Create user integrity error: {e}")
            raise ValueError('用户创建失败，数据冲突')
        except Exception as e:
            db.session.rollback()
            logger.error(f"Create user error: {e}")
            raise
    
    def update_user(self, user_id, user_data):
        """更新用户"""
        try:
            user = User.get_by_tenant(user_id)
            if not user:
                raise ValueError('用户不存在')
            
            # 更新基本信息
            if 'email' in user_data:
                # 检查邮箱是否已被其他用户使用
                existing_user = User.query.filter(
                    User.email == user_data['email'],
                    User.id != user_id
                ).first()
                if existing_user:
                    raise ValueError('邮箱已被其他用户使用')
                user.email = user_data['email']
            
            if 'full_name' in user_data:
                user.full_name = user_data['full_name']
            
            if 'status' in user_data:
                user.status = user_data['status']
            
            # 更新头像配置
            if 'avatar_style' in user_data:
                user.avatar_style = user_data['avatar_style']
            if 'avatar_seed' in user_data:
                user.avatar_seed = user_data['avatar_seed']
            if 'avatar_config' in user_data:
                user.set_avatar_config(user_data['avatar_config'])
            
            # 更新密码
            if 'password' in user_data and user_data['password']:
                user.set_password(user_data['password'])
            
            # 更新角色
            if 'role_ids' in user_data:
                self._assign_user_roles(user_id, user_data['role_ids'])
            
            db.session.commit()
            
            return user.to_dict()
            
        except IntegrityError as e:
            db.session.rollback()
            logger.error(f"Update user integrity error: {e}")
            raise ValueError('用户更新失败，数据冲突')
        except Exception as e:
            db.session.rollback()
            logger.error(f"Update user error: {e}")
            raise
    
    def delete_user(self, user_id, current_user_id=None):
        """删除用户"""
        try:
            user = User.get_by_tenant(user_id)
            if not user:
                raise ValueError('用户不存在')
            
            # 检查是否是当前用户
            if current_user_id and current_user_id == user_id:
                raise ValueError('不能删除当前登录用户')
            
            # 检查是否是admin用户
            if user.username == 'admin':
                raise ValueError('不能删除admin用户')
            
            # 删除用户（级联删除相关记录）
            db.session.delete(user)
            db.session.commit()
            
            return True
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Delete user error: {e}")
            raise
    
    def get_user_avatar(self, user_id):
        """获取用户头像信息"""
        try:
            user = User.get_by_tenant(user_id)
            if not user:
                raise ValueError('用户不存在')
            
            return {
                'avatar_style': user.avatar_style,
                'avatar_seed': user.avatar_seed,
                'avatar_config': user.get_avatar_config(),
                'avatar_url': user.get_avatar_url()
            }
            
        except Exception as e:
            logger.error(f"Get user avatar error: {e}")
            raise
    
    def update_user_avatar(self, user_id, avatar_data, current_user_id=None, is_admin=False):
        """更新用户头像配置"""
        try:
            user = User.get_by_tenant(user_id)
            if not user:
                raise ValueError('用户不存在')
            
            # 检查权限：只能修改自己的头像或管理员可以修改任何用户的头像
            if current_user_id != user_id and not is_admin:
                raise ValueError('权限不足')
            
            if 'avatar_style' in avatar_data:
                user.avatar_style = avatar_data['avatar_style']
            if 'avatar_seed' in avatar_data:
                user.avatar_seed = avatar_data['avatar_seed']
            if 'avatar_config' in avatar_data:
                user.set_avatar_config(avatar_data['avatar_config'])
            
            db.session.commit()
            
            return {
                'avatar_style': user.avatar_style,
                'avatar_seed': user.avatar_seed,
                'avatar_config': user.get_avatar_config(),
                'avatar_url': user.get_avatar_url()
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Update user avatar error: {e}")
            raise
    
    def generate_user_avatar(self, user_id, current_user_id=None, is_admin=False):
        """生成随机头像"""
        try:
            user = User.get_by_tenant(user_id)
            if not user:
                raise ValueError('用户不存在')
            
            # 检查权限
            if current_user_id != user_id and not is_admin:
                raise ValueError('权限不足')
            
            # 生成随机种子值
            user.avatar_seed = str(uuid.uuid4())
            
            # 重置头像配置为默认值
            user.set_avatar_config({})
            
            db.session.commit()
            
            return {
                'avatar_style': user.avatar_style,
                'avatar_seed': user.avatar_seed,
                'avatar_config': user.get_avatar_config(),
                'avatar_url': user.get_avatar_url()
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Generate user avatar error: {e}")
            raise
    
    def _assign_user_roles(self, user_id, role_ids):
        """分配用户角色"""
        try:
            # 删除现有角色关联
            UserRole.query.filter_by(user_id=user_id).delete()
            
            # 添加新的角色关联
            for role_id in role_ids:
                # 验证角色是否属于当前租户
                role = Role.query_by_tenant().filter_by(id=role_id).first()
                if role:
                    user_role = UserRole(user_id=user_id, role_id=role_id)
                    db.session.add(user_role)
                else:
                    logger.warning(f"Role {role_id} not found for tenant {g.tenant_id}")
            
        except Exception as e:
            logger.error(f"Assign user roles error: {e}")
            raise


# 创建全局用户服务实例
user_service = UserService()
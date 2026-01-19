"""
角色模型
"""
from app.extensions import db
from .base import BaseModel


class Role(BaseModel):
    """角色模型"""
    __tablename__ = 'roles'
    
    name = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text)
    permissions = db.Column(db.JSON)  # 权限列表
    status = db.Column(db.Integer, default=1)  # 1: 启用, 0: 禁用
    
    # 关联关系
    user_roles = db.relationship('UserRole', backref='role', lazy='dynamic', cascade='all, delete-orphan')
    
    def get_display_name(self):
        """获取角色显示名称"""
        display_names = {
            'super_admin': '超级管理员',
            'admin': '运维管理员',
            'user': '普通用户',
            'system_admin': '系统管理员'
        }
        return display_names.get(self.name, self.name)
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        
        # 获取使用该角色的用户数量
        user_count = UserRole.query.filter_by(role_id=self.id).count() if self.id else 0
        
        result.update({
            'name': self.name,
            'display_name': self.get_display_name(),
            'description': self.description,
            'permissions': self.permissions or [],
            'user_count': user_count,
            'status': self.status if hasattr(self, 'status') else 1  # 默认启用
        })
        return result
    
    def __repr__(self):
        return f'<Role {self.name}>'


class UserRole(db.Model):
    """用户角色关联表"""
    __tablename__ = 'user_roles'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp(), nullable=False)
    
    # 唯一约束
    __table_args__ = (db.UniqueConstraint('user_id', 'role_id', name='unique_user_role'),)
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'role_id': self.role_id,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<UserRole user_id={self.user_id} role_id={self.role_id}>'
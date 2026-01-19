"""
系统设置模型
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel


class SystemSetting(BaseModel):
    """系统设置模型"""
    __tablename__ = 'system_settings'
    
    # 设置键名（唯一标识）
    key = db.Column(db.String(100), nullable=False, index=True)
    
    # 设置值（JSON格式存储复杂配置）
    value = db.Column(db.JSON, nullable=True)
    
    # 设置类型（用于分类管理）
    category = db.Column(db.String(50), nullable=False, default='general')
    
    # 设置描述
    description = db.Column(db.Text)
    
    # 是否为系统级设置（不允许删除）
    is_system = db.Column(db.Boolean, default=False, nullable=False)
    
    # 是否启用
    is_enabled = db.Column(db.Boolean, default=True, nullable=False)
    
    # 创建者
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 最后修改者
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # 联合唯一索引：租户+键名
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'key', name='uq_tenant_setting_key'),
        db.Index('idx_tenant_category', 'tenant_id', 'category'),
    )
    
    @classmethod
    def get_setting(cls, key, tenant_id=None, default=None):
        """获取设置值"""
        from flask import g
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        setting = cls.query.filter(
            cls.tenant_id == tenant_id,
            cls.key == key,
            cls.is_enabled == True
        ).first()
        
        return setting.value if setting else default
    
    @classmethod
    def set_setting(cls, key, value, category='general', description=None, user_id=None):
        """设置配置值"""
        from flask import g
        tenant_id = getattr(g, 'tenant_id', None)
        if user_id is None:
            user_id = getattr(g, 'user_id', None)
        
        if tenant_id is None or user_id is None:
            raise ValueError("租户ID和用户ID不能为空")
        
        # 查找现有设置
        setting = cls.query.filter(
            cls.tenant_id == tenant_id,
            cls.key == key
        ).first()
        
        if setting:
            # 更新现有设置
            setting.value = value
            setting.category = category
            setting.description = description
            setting.updated_by = user_id
            setting.updated_at = datetime.utcnow()
        else:
            # 创建新设置
            setting = cls(
                tenant_id=tenant_id,
                key=key,
                value=value,
                category=category,
                description=description,
                created_by=user_id
            )
            db.session.add(setting)
        
        db.session.commit()
        return setting
    
    @classmethod
    def get_category_settings(cls, category, tenant_id=None):
        """获取分类下的所有设置"""
        from flask import g
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        settings = cls.query.filter(
            cls.tenant_id == tenant_id,
            cls.category == category,
            cls.is_enabled == True
        ).all()
        
        return {setting.key: setting.value for setting in settings}
    
    @classmethod
    def delete_setting(cls, key, tenant_id=None):
        """删除设置（仅非系统设置）"""
        from flask import g
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        setting = cls.query.filter(
            cls.tenant_id == tenant_id,
            cls.key == key
        ).first()
        
        if setting and not setting.is_system:
            db.session.delete(setting)
            db.session.commit()
            return True
        
        return False
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        # 添加创建者和更新者信息
        if hasattr(self, 'creator'):
            result['creator_name'] = self.creator.full_name or self.creator.username
        if hasattr(self, 'updater'):
            result['updater_name'] = self.updater.full_name or self.updater.username
        return result


# 关联关系
from .user import User
SystemSetting.creator = db.relationship('User', foreign_keys=[SystemSetting.created_by], backref='created_settings')
SystemSetting.updater = db.relationship('User', foreign_keys=[SystemSetting.updated_by], backref='updated_settings')
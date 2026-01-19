"""
基础模型类，包含多租户支持
"""
from datetime import datetime
from flask import g
from app.extensions import db


class BaseModel(db.Model):
    """基础模型类，包含 tenant_id 字段用于多租户数据隔离"""
    __abstract__ = True
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    @classmethod
    def query_by_tenant(cls, tenant_id=None):
        """按租户查询"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        return cls.query.filter(cls.tenant_id == tenant_id)
    
    @classmethod
    def get_by_tenant(cls, id, tenant_id=None):
        """按租户获取单个记录"""
        if tenant_id is None:
            tenant_id = getattr(g, 'tenant_id', None)
        
        if tenant_id is None:
            raise ValueError("租户ID不能为空")
        
        return cls.query.filter(cls.tenant_id == tenant_id, cls.id == id).first()
    
    def to_dict(self):
        """转换为字典格式"""
        result = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                result[column.name] = value.isoformat()
            else:
                result[column.name] = value
        return result
    
    def update_from_dict(self, data):
        """从字典更新模型属性"""
        for key, value in data.items():
            if hasattr(self, key) and key not in ['id', 'created_at']:
                setattr(self, key, value)
        self.updated_at = datetime.utcnow()
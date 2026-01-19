"""
全局配置模型 - 不依赖租户，用于存储系统级配置
"""
from datetime import datetime
from app.extensions import db


class GlobalConfig(db.Model):
    """全局配置模型（不依赖租户）"""
    __tablename__ = 'global_configs'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # 配置键名（唯一）
    key = db.Column(db.String(100), unique=True, nullable=False, index=True)
    
    # 配置值（文本格式，支持存储 PEM 密钥等长文本）
    value = db.Column(db.Text, nullable=True)
    
    # 配置描述
    description = db.Column(db.String(255))
    
    # 创建时间
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # 更新时间
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @classmethod
    def get(cls, key, default=None):
        """获取配置值"""
        config = cls.query.filter_by(key=key).first()
        return config.value if config else default
    
    @classmethod
    def set(cls, key, value, description=None):
        """设置配置值"""
        config = cls.query.filter_by(key=key).first()
        if config:
            config.value = value
            if description:
                config.description = description
            config.updated_at = datetime.utcnow()
        else:
            config = cls(key=key, value=value, description=description)
            db.session.add(config)
        db.session.commit()
        return config
    
    @classmethod
    def exists(cls, key):
        """检查配置是否存在"""
        return cls.query.filter_by(key=key).first() is not None

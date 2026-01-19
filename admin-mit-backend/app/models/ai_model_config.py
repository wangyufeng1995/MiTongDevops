"""
AI模型配置数据模型
"""
from datetime import datetime
from app.extensions import db
from sqlalchemy import Index

class AIModelConfig(db.Model):
    """AI模型配置表"""
    __tablename__ = 'ai_model_config'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, nullable=False, comment='租户ID')
    
    # 配置名称和描述
    name = db.Column(db.String(100), nullable=False, comment='配置名称')
    description = db.Column(db.String(500), comment='配置描述')
    
    # API配置
    api_key = db.Column(db.Text, nullable=False, comment='API密钥（加密存储）')
    api_endpoint = db.Column(db.String(500), comment='API端点')
    timeout = db.Column(db.Integer, default=30, comment='超时时间（秒）')
    
    # 模型参数
    model_name = db.Column(db.String(100), nullable=False, comment='模型名称')
    temperature = db.Column(db.Float, default=0.7, comment='温度参数')
    max_tokens = db.Column(db.Integer, default=2000, comment='最大令牌数')
    top_p = db.Column(db.Float, default=1.0, comment='Top P参数')
    frequency_penalty = db.Column(db.Float, default=0.0, comment='频率惩罚')
    presence_penalty = db.Column(db.Float, default=0.0, comment='存在惩罚')
    
    # 系统提示词
    system_prompt = db.Column(db.Text, comment='系统提示词')
    
    # 状态和元数据
    is_active = db.Column(db.Boolean, default=True, comment='是否启用')
    is_default = db.Column(db.Boolean, default=False, comment='是否为默认配置')
    
    # 时间戳
    created_at = db.Column(db.DateTime, default=datetime.utcnow, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment='更新时间')
    created_by = db.Column(db.Integer, comment='创建人ID')
    updated_by = db.Column(db.Integer, comment='更新人ID')
    
    # 索引
    __table_args__ = (
        Index('idx_tenant_active', 'tenant_id', 'is_active'),
        Index('idx_tenant_default', 'tenant_id', 'is_default'),
    )
    
    def to_dict(self, include_api_key=False):
        """转换为字典"""
        data = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'name': self.name,
            'description': self.description,
            'api_endpoint': self.api_endpoint,
            'timeout': self.timeout,
            'model_name': self.model_name,
            'temperature': self.temperature,
            'max_tokens': self.max_tokens,
            'top_p': self.top_p,
            'frequency_penalty': self.frequency_penalty,
            'presence_penalty': self.presence_penalty,
            'system_prompt': self.system_prompt,
            'is_active': self.is_active,
            'is_default': self.is_default,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        # 只在需要时返回API密钥（用于编辑）
        if include_api_key:
            data['api_key'] = self.api_key
        else:
            # 返回掩码版本
            if self.api_key:
                data['api_key_masked'] = self.api_key[:8] + '...' + self.api_key[-4:] if len(self.api_key) > 12 else '***'
        
        return data
    
    def __repr__(self):
        return f'<AIModelConfig {self.name}>'

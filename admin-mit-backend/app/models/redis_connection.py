"""
Redis 连接配置模型
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel


class RedisConnection(BaseModel):
    """Redis 连接配置模型"""
    __tablename__ = 'redis_connections'
    
    name = db.Column(db.String(100), nullable=False)
    connection_type = db.Column(db.String(20), nullable=False, default='standalone')  # 'standalone' | 'cluster'
    host = db.Column(db.String(255))  # 主机地址 (单机模式)
    port = db.Column(db.Integer, default=6379)  # 端口 (单机模式)
    password = db.Column(db.Text)  # 密码 (加密存储)
    database = db.Column(db.Integer, default=0)  # 数据库索引 (单机模式, 0-15)
    cluster_nodes = db.Column(db.Text)  # 集群节点列表 (JSON格式)
    timeout = db.Column(db.Integer, default=5)  # 连接超时 (秒)
    description = db.Column(db.Text)  # 描述
    status = db.Column(db.Integer, default=1)  # 状态: 0-禁用, 1-启用
    
    # 唯一约束：同一租户下连接名称唯一
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'name', name='uq_redis_connection_tenant_name'),
    )
    
    def to_dict(self, include_sensitive=False):
        """
        转换为字典格式
        
        Args:
            include_sensitive: 是否包含敏感字段（如密码）
            
        Returns:
            dict: 连接配置字典
        """
        result = {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'name': self.name,
            'connection_type': self.connection_type,
            'host': self.host,
            'port': self.port,
            'database': self.database,
            'cluster_nodes': self.cluster_nodes,
            'timeout': self.timeout,
            'description': self.description,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        # 只有明确请求时才包含密码
        if include_sensitive:
            result['password'] = self.password
        
        return result
    
    def __repr__(self):
        return f'<RedisConnection {self.name}>'

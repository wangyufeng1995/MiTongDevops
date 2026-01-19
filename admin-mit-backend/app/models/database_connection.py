"""
数据库连接配置模型

支持多种数据库类型：PostgreSQL、MySQL、达梦DM、Oracle
密码使用 Fernet 对称加密存储。

Requirements: 1.1, 1.6, 1.7, 1.8
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel


# 支持的数据库类型及其默认端口
DATABASE_TYPES = {
    'postgresql': {
        'name': 'PostgreSQL',
        'default_port': 5432,
    },
    'mysql': {
        'name': 'MySQL',
        'default_port': 3306,
    },
    'dm': {
        'name': '达梦 DM',
        'default_port': 5236,
    },
    'oracle': {
        'name': 'Oracle',
        'default_port': 1521,
    },
}


class DatabaseConnection(BaseModel):
    """
    数据库连接配置模型
    
    支持 PostgreSQL、MySQL、达梦DM、Oracle 四种数据库类型。
    密码字段使用加密存储。
    
    Attributes:
        name: 连接名称
        db_type: 数据库类型 ('postgresql', 'mysql', 'dm', 'oracle')
        host: 主机地址
        port: 端口号
        username: 用户名
        password: 密码（加密存储）
        database: 数据库名
        schema: Schema 名称（可选，用于 PostgreSQL）
        service_name: Oracle Service Name（可选）
        sid: Oracle SID（可选）
        timeout: 连接超时时间（秒）
        description: 描述
        status: 状态（0-禁用, 1-启用）
    """
    __tablename__ = 'database_connections'
    
    # 基本信息
    name = db.Column(db.String(100), nullable=False, comment='连接名称')
    db_type = db.Column(db.String(20), nullable=False, comment='数据库类型')
    
    # 连接参数
    host = db.Column(db.String(255), nullable=False, comment='主机地址')
    port = db.Column(db.Integer, nullable=False, comment='端口号')
    username = db.Column(db.String(100), nullable=False, comment='用户名')
    password = db.Column(db.Text, comment='密码（加密存储）')
    database = db.Column(db.String(100), comment='数据库名')
    schema = db.Column(db.String(100), comment='Schema名称')
    
    # Oracle 特定参数
    service_name = db.Column(db.String(100), comment='Oracle Service Name')
    sid = db.Column(db.String(100), comment='Oracle SID')
    
    # 其他配置
    timeout = db.Column(db.Integer, default=10, comment='连接超时（秒）')
    description = db.Column(db.Text, comment='描述')
    status = db.Column(db.Integer, default=1, comment='状态: 0-禁用, 1-启用')
    
    # 唯一约束：同一租户下连接名称唯一
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'name', name='uq_database_connection_tenant_name'),
        db.Index('idx_database_connections_type', 'db_type'),
    )
    
    @staticmethod
    def get_default_port(db_type: str) -> int:
        """
        获取数据库类型的默认端口
        
        Args:
            db_type: 数据库类型
            
        Returns:
            int: 默认端口号
        """
        type_config = DATABASE_TYPES.get(db_type)
        if type_config:
            return type_config['default_port']
        return 0
    
    @staticmethod
    def get_supported_types() -> list:
        """
        获取支持的数据库类型列表
        
        Returns:
            list: 数据库类型配置列表
        """
        return [
            {
                'type': db_type,
                'name': config['name'],
                'default_port': config['default_port'],
            }
            for db_type, config in DATABASE_TYPES.items()
        ]
    
    @staticmethod
    def is_valid_type(db_type: str) -> bool:
        """
        检查数据库类型是否有效
        
        Args:
            db_type: 数据库类型
            
        Returns:
            bool: 是否有效
        """
        return db_type in DATABASE_TYPES
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
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
            'db_type': self.db_type,
            'host': self.host,
            'port': self.port,
            'username': self.username,
            'database': self.database,
            'schema': self.schema,
            'service_name': self.service_name,
            'sid': self.sid,
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
        return f'<DatabaseConnection {self.name} ({self.db_type})>'

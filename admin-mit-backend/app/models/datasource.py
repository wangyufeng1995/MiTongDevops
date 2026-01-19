"""
数据源配置相关模型
支持 Prometheus、VictoriaMetrics 等时序数据库
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel


# 支持的数据源类型
DATASOURCE_TYPES = ['prometheus', 'victoriametrics']

# 支持的认证类型
AUTH_TYPES = ['none', 'basic', 'bearer']


class DatasourceConfig(BaseModel):
    """数据源配置模型"""
    __tablename__ = 'datasource_configs'
    
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), default='prometheus')  # prometheus, victoriametrics
    url = db.Column(db.String(500), nullable=False)
    auth_type = db.Column(db.String(20), default='none')  # none, basic, bearer
    username = db.Column(db.String(100))
    password = db.Column(db.String(500))  # 明文存储
    token = db.Column(db.String(1000))    # 明文存储
    is_default = db.Column(db.Boolean, default=False)
    status = db.Column(db.Integer, default=1)  # 0: 禁用, 1: 启用
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # 关联关系
    saved_queries = db.relationship('SavedPromQLQuery', backref='config', lazy='dynamic', cascade='all, delete-orphan')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_datasource_configs')
    
    # 唯一约束：同一租户下名称唯一
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'name', name='uq_datasource_configs_tenant_name'),
    )
    
    def validate_config(self):
        """验证数据源配置"""
        # 验证数据源类型
        if self.type not in DATASOURCE_TYPES:
            return False, f"不支持的数据源类型: {self.type}"
        
        # 验证 URL
        if not self.url:
            return False, "服务器 URL 不能为空"
        
        if not self.url.startswith(('http://', 'https://')):
            return False, "服务器 URL 必须以 http:// 或 https:// 开头"
        
        # 验证认证类型
        if self.auth_type not in AUTH_TYPES:
            return False, f"不支持的认证类型: {self.auth_type}"
        
        # 验证认证字段
        if self.auth_type == 'basic':
            if not self.username or not self.password:
                return False, "Basic Auth 认证需要配置用户名和密码"
        elif self.auth_type == 'bearer':
            if not self.token:
                return False, "Bearer Token 认证需要配置 Token"
        
        return True, "配置验证通过"
    
    def is_enabled(self):
        """检查配置是否启用"""
        return self.status == 1
    
    def get_auth_headers(self):
        """获取认证请求头"""
        headers = {}
        if self.auth_type == 'basic':
            import base64
            credentials = base64.b64encode(f"{self.username}:{self.password}".encode()).decode()
            headers['Authorization'] = f'Basic {credentials}'
        elif self.auth_type == 'bearer':
            headers['Authorization'] = f'Bearer {self.token}'
        return headers
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'name': self.name,
            'type': self.type,
            'url': self.url,
            'auth_type': self.auth_type,
            'username': self.username,
            # 不返回密码和 token 的明文
            'has_password': bool(self.password),
            'has_token': bool(self.token),
            'is_default': self.is_default,
            'status': self.status,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None
        })
        return result
    
    def to_dict_with_credentials(self):
        """转换为字典格式（包含凭证，仅用于内部使用）"""
        result = self.to_dict()
        result['password'] = self.password
        result['token'] = self.token
        return result
    
    def __repr__(self):
        return f'<DatasourceConfig {self.name}>'


class SavedPromQLQuery(db.Model):
    """保存的 PromQL 查询模型"""
    __tablename__ = 'saved_promql_queries'
    
    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    config_id = db.Column(db.Integer, db.ForeignKey('datasource_configs.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    query = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # 关联关系
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_saved_queries')
    
    # 唯一约束：同一租户下同一配置的查询名称唯一
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'config_id', 'name', name='uq_saved_queries_tenant_config_name'),
    )
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'config_id': self.config_id,
            'config_name': self.config.name if self.config else None,
            'name': self.name,
            'query': self.query,
            'description': self.description,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<SavedPromQLQuery {self.name}>'


# 预置的 PromQL 查询模板
PROMQL_TEMPLATES = [
    {
        "name": "CPU 使用率",
        "query": "100 - (avg by(instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)",
        "description": "计算所有节点的 CPU 使用率百分比"
    },
    {
        "name": "内存使用率",
        "query": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
        "description": "计算内存使用率百分比"
    },
    {
        "name": "磁盘使用率",
        "query": "(1 - (node_filesystem_avail_bytes{fstype!=\"tmpfs\"} / node_filesystem_size_bytes{fstype!=\"tmpfs\"})) * 100",
        "description": "计算磁盘使用率百分比"
    },
    {
        "name": "网络接收速率",
        "query": "rate(node_network_receive_bytes_total[5m])",
        "description": "计算网络接收速率 (bytes/s)"
    },
    {
        "name": "网络发送速率",
        "query": "rate(node_network_transmit_bytes_total[5m])",
        "description": "计算网络发送速率 (bytes/s)"
    },
    {
        "name": "HTTP 请求速率",
        "query": "sum(rate(http_requests_total[5m])) by (status_code)",
        "description": "按状态码统计 HTTP 请求速率"
    },
    {
        "name": "容器 CPU 使用率",
        "query": "sum(rate(container_cpu_usage_seconds_total[5m])) by (container_name) * 100",
        "description": "计算容器 CPU 使用率"
    },
    {
        "name": "容器内存使用",
        "query": "container_memory_usage_bytes / 1024 / 1024",
        "description": "容器内存使用量 (MB)"
    }
]

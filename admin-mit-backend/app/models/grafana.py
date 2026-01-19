"""
Grafana 配置相关模型
支持 Grafana 仪表盘 iframe 嵌入展示
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel


class GrafanaConfig(BaseModel):
    """Grafana 配置模型"""
    __tablename__ = 'grafana_configs'
    
    name = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    status = db.Column(db.Integer, default=1)  # 0: 禁用, 1: 启用
    iframe_height = db.Column(db.Integer, default=800)  # iframe 高度
    
    # 认证配置
    auth_type = db.Column(db.String(20), default='none')  # none, basic, token, api_key
    auth_username = db.Column(db.String(100))  # Basic Auth 用户名
    auth_password = db.Column(db.String(200))  # Basic Auth 密码（加密存储）
    auth_token = db.Column(db.String(500))  # Bearer Token
    api_key = db.Column(db.String(500))  # API Key
    
    # 代理配置
    use_proxy = db.Column(db.Boolean, default=True)  # 是否使用后端代理
    allow_anonymous = db.Column(db.Boolean, default=False)  # 是否允许匿名访问
    
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    
    # 关联关系
    dashboards = db.relationship('GrafanaDashboard', backref='config', lazy='dynamic', cascade='all, delete-orphan')
    creator = db.relationship('User', foreign_keys=[created_by], backref='created_grafana_configs')
    
    # 唯一约束：同一租户下名称唯一
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'name', name='uq_grafana_configs_tenant_name'),
    )
    
    def validate_config(self):
        """验证 Grafana 配置"""
        # 验证名称
        if not self.name:
            return False, "配置名称不能为空"
        
        # 验证 URL
        if not self.url:
            return False, "Grafana 服务器 URL 不能为空"
        
        if not self.url.startswith(('http://', 'https://')):
            return False, "Grafana 服务器 URL 必须以 http:// 或 https:// 开头"
        
        # 验证 iframe 高度
        if self.iframe_height is not None and self.iframe_height < 100:
            return False, "iframe 高度不能小于 100"
        
        return True, "配置验证通过"
    
    def is_enabled(self):
        """检查配置是否启用"""
        return self.status == 1
    
    def get_default_dashboard(self):
        """获取默认仪表盘"""
        return self.dashboards.filter_by(is_default=True).first()
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'name': self.name,
            'url': self.url,
            'status': self.status,
            'iframe_height': self.iframe_height,
            'auth_type': self.auth_type,
            'auth_username': self.auth_username,
            # 不返回密码和密钥的实际值
            'has_auth_password': bool(self.auth_password),
            'has_auth_token': bool(self.auth_token),
            'has_api_key': bool(self.api_key),
            'use_proxy': self.use_proxy,
            'allow_anonymous': self.allow_anonymous,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None,
            'dashboards': [d.to_dict() for d in self.dashboards.order_by(GrafanaDashboard.sort_order).all()],
            'dashboard_count': self.dashboards.count()
        })
        return result
    
    def to_dict_simple(self):
        """转换为简单字典格式（不包含仪表盘列表）"""
        result = super().to_dict()
        result.update({
            'name': self.name,
            'url': self.url,
            'status': self.status,
            'iframe_height': self.iframe_height,
            'auth_type': self.auth_type,
            'auth_username': self.auth_username,
            # 不返回密码和密钥的实际值
            'has_auth_password': bool(self.auth_password),
            'has_auth_token': bool(self.auth_token),
            'has_api_key': bool(self.api_key),
            'use_proxy': self.use_proxy,
            'allow_anonymous': self.allow_anonymous,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None,
            'dashboard_count': self.dashboards.count()
        })
        return result
    
    def __repr__(self):
        return f'<GrafanaConfig {self.name}>'


class GrafanaDashboard(db.Model):
    """Grafana 仪表盘模型"""
    __tablename__ = 'grafana_dashboards'
    
    id = db.Column(db.Integer, primary_key=True)
    config_id = db.Column(db.Integer, db.ForeignKey('grafana_configs.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    url = db.Column(db.String(1000), nullable=False)  # 完整的仪表盘 URL
    description = db.Column(db.Text)
    is_default = db.Column(db.Boolean, default=False)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # 唯一约束：同一配置下仪表盘名称唯一
    __table_args__ = (
        db.UniqueConstraint('config_id', 'name', name='uq_grafana_dashboards_config_name'),
    )
    
    def validate_dashboard(self):
        """验证仪表盘配置"""
        # 验证名称
        if not self.name:
            return False, "仪表盘名称不能为空"
        
        # 验证 URL
        if not self.url:
            return False, "仪表盘 URL 不能为空"
        
        if not self.url.startswith(('http://', 'https://')):
            return False, "仪表盘 URL 必须以 http:// 或 https:// 开头"
        
        return True, "配置验证通过"
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'config_id': self.config_id,
            'config_name': self.config.name if self.config else None,
            'name': self.name,
            'url': self.url,
            'description': self.description,
            'is_default': self.is_default,
            'sort_order': self.sort_order,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<GrafanaDashboard {self.name}>'

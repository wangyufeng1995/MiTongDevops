"""
用户模型
"""
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db
from .base import BaseModel


class User(BaseModel):
    """用户模型"""
    __tablename__ = 'users'
    
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100))
    
    # DiceBear 头像配置
    avatar_style = db.Column(db.String(50), default='avataaars')  # 头像风格
    avatar_seed = db.Column(db.String(100))  # 头像种子值
    avatar_config = db.Column(db.JSON)  # 头像配置参数（颜色、配件等）
    
    status = db.Column(db.Integer, default=1)  # 1: 活跃, 0: 禁用
    
    # 关联关系
    user_roles = db.relationship('UserRole', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    operation_logs = db.relationship('OperationLog', backref='user', lazy='dynamic')
    created_playbooks = db.relationship('AnsiblePlaybook', backref='creator', lazy='dynamic', foreign_keys='AnsiblePlaybook.created_by')
    executed_playbooks = db.relationship('PlaybookExecution', backref='executor', lazy='dynamic')
    created_alert_channels = db.relationship('AlertChannel', backref='creator', lazy='dynamic')
    created_alert_rules = db.relationship('AlertRule', backref='creator', lazy='dynamic')
    acknowledged_alerts = db.relationship('AlertRecord', backref='acknowledger', lazy='dynamic')
    created_network_groups = db.relationship('NetworkProbeGroup', backref='creator', lazy='dynamic')
    created_network_probes = db.relationship('NetworkProbe', backref='creator', lazy='dynamic')
    created_network_alert_rules = db.relationship('NetworkAlertRule', backref='creator', lazy='dynamic')
    acknowledged_network_alerts = db.relationship('NetworkAlertRecord', backref='acknowledger', lazy='dynamic')
    
    def set_password(self, password):
        """设置密码"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """验证密码"""
        return check_password_hash(self.password_hash, password)
    
    def get_roles(self):
        """获取用户角色列表"""
        return [ur.role for ur in self.user_roles]
    
    def has_role(self, role_name):
        """检查用户是否有指定角色"""
        return any(ur.role.name == role_name for ur in self.user_roles)
    
    def get_avatar_config(self):
        """获取头像配置"""
        return self.avatar_config or {}
    
    def set_avatar_config(self, config):
        """设置头像配置"""
        self.avatar_config = config or {}
    
    def get_avatar_url(self):
        """获取头像 URL"""
        if not self.avatar_style or not self.avatar_seed:
            return None
        
        # 构建 DiceBear 头像 URL
        base_url = f"https://api.dicebear.com/7.x/{self.avatar_style}/svg"
        params = [f"seed={self.avatar_seed}"]
        
        # 添加配置参数
        if self.avatar_config:
            for key, value in self.avatar_config.items():
                if value:
                    params.append(f"{key}={value}")
        
        return f"{base_url}?{'&'.join(params)}"
    
    def to_dict(self, include_sensitive=False):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'avatar_style': self.avatar_style,
            'avatar_seed': self.avatar_seed,
            'avatar_config': self.avatar_config,
            'avatar_url': self.get_avatar_url(),
            'status': self.status,
            'roles': [role.to_dict() for role in self.get_roles()]
        })
        
        if not include_sensitive:
            result.pop('password_hash', None)
        
        return result
    
    def __repr__(self):
        return f'<User {self.username}>'
"""
监控告警相关模型
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel


class AlertChannel(BaseModel):
    """告警渠道模型"""
    __tablename__ = 'alert_channels'
    
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'email' or 'dingtalk'
    config = db.Column(db.JSON, nullable=False)  # 配置信息（邮箱地址、钉钉机器人 webhook 等）
    description = db.Column(db.Text)
    status = db.Column(db.Integer, default=1)  # 1: 启用, 0: 禁用
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 关联关系 (creator 由 User 模型的 backref 自动创建)
    notifications = db.relationship('AlertNotification', backref='channel', lazy='dynamic')
    
    def validate_config(self):
        """验证渠道配置"""
        if not self.config:
            return False, "配置信息不能为空"
        
        if self.type == 'email':
            required_fields = ['smtp_server', 'smtp_port', 'username', 'password', 'from_email', 'to_emails']
            for field in required_fields:
                if field not in self.config:
                    return False, f"邮箱配置缺少必需字段: {field}"
            
            if not isinstance(self.config.get('to_emails'), list) or not self.config['to_emails']:
                return False, "收件人邮箱列表不能为空"
        
        elif self.type == 'dingtalk':
            if 'webhook_url' not in self.config:
                return False, "钉钉配置缺少webhook_url"
            
            if not self.config['webhook_url'].startswith('https://oapi.dingtalk.com/robot/send'):
                return False, "钉钉webhook_url格式不正确"
            
            # 验证安全设置
            security_type = self.config.get('security_type', 'none')
            if security_type == 'signature':
                if not self.config.get('secret'):
                    return False, "使用加签安全设置时需要配置secret密钥"
            elif security_type == 'keyword':
                keywords = self.config.get('keywords', [])
                if not isinstance(keywords, list) or len(keywords) == 0:
                    return False, "使用关键词安全设置时需要配置至少一个关键词"
        
        else:
            return False, f"不支持的渠道类型: {self.type}"
        
        return True, "配置验证通过"
    
    def is_enabled(self):
        """检查渠道是否启用"""
        return self.status == 1
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'name': self.name,
            'type': self.type,
            'config': self.config,
            'description': self.description,
            'status': self.status,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None
        })
        return result
    
    def __repr__(self):
        return f'<AlertChannel {self.name}>'


class AlertRule(BaseModel):
    """告警规则模型"""
    __tablename__ = 'alert_rules'
    
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    metric_type = db.Column(db.String(50), nullable=False)  # 'cpu', 'memory', 'disk', 'load'
    condition_operator = db.Column(db.String(10), nullable=False)  # '>', '<', '>=', '<=', '=='
    threshold_value = db.Column(db.Numeric(10, 2), nullable=False)
    duration = db.Column(db.Integer, default=300)  # 持续时间（秒）
    severity = db.Column(db.String(20), default='warning')  # 'info', 'warning', 'critical'
    host_ids = db.Column(db.JSON)  # 监控的主机 ID 数组，null 表示所有主机
    channel_ids = db.Column(db.JSON, nullable=False)  # 告警渠道 ID 数组
    silence_period = db.Column(db.Integer, default=3600)  # 静默期（秒）
    enabled = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 关联关系
    alert_records = db.relationship('AlertRecord', backref='rule', lazy='dynamic', cascade='all, delete-orphan')
    
    def validate_rule(self):
        """验证告警规则"""
        # 验证指标类型
        valid_metrics = ['cpu', 'memory', 'disk', 'load']
        if self.metric_type not in valid_metrics:
            return False, f"不支持的指标类型: {self.metric_type}"
        
        # 验证操作符
        valid_operators = ['>', '<', '>=', '<=', '==']
        if self.condition_operator not in valid_operators:
            return False, f"不支持的操作符: {self.condition_operator}"
        
        # 验证阈值
        if self.threshold_value is None or float(self.threshold_value) < 0:
            return False, "阈值必须为非负数"
        
        # 验证百分比类型的指标
        if self.metric_type in ['cpu', 'memory', 'disk'] and float(self.threshold_value) > 100:
            return False, f"{self.metric_type}使用率阈值不能超过100%"
        
        # 验证严重级别
        valid_severities = ['info', 'warning', 'critical']
        if self.severity not in valid_severities:
            return False, f"不支持的严重级别: {self.severity}"
        
        # 验证持续时间
        if self.duration is not None and self.duration < 0:
            return False, "持续时间不能为负数"
        
        # 验证静默期
        if self.silence_period is not None and self.silence_period < 0:
            return False, "静默期不能为负数"
        
        # 验证告警渠道
        if not self.channel_ids or not isinstance(self.channel_ids, list) or len(self.channel_ids) == 0:
            return False, "至少需要配置一个告警渠道"
        
        return True, "规则验证通过"
    
    def is_enabled(self):
        """检查规则是否启用"""
        return self.enabled is True
    
    def applies_to_host(self, host_id):
        """检查规则是否适用于指定主机"""
        if not self.host_ids:  # 空数组表示适用于所有主机
            return True
        return host_id in self.host_ids
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'name': self.name,
            'description': self.description,
            'metric_type': self.metric_type,
            'condition_operator': self.condition_operator,
            'threshold_value': float(self.threshold_value) if self.threshold_value else None,
            'duration': self.duration,
            'severity': self.severity,
            'host_ids': self.host_ids or [],
            'channel_ids': self.channel_ids or [],
            'silence_period': self.silence_period,
            'enabled': self.enabled,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None
        })
        return result
    
    def __repr__(self):
        return f'<AlertRule {self.name}>'


class AlertRecord(BaseModel):
    """告警记录模型"""
    __tablename__ = 'alert_records'
    
    rule_id = db.Column(db.Integer, db.ForeignKey('alert_rules.id'), nullable=False)
    host_id = db.Column(db.Integer, db.ForeignKey('ssh_hosts.id'), nullable=False)
    metric_type = db.Column(db.String(50), nullable=False)
    current_value = db.Column(db.Numeric(10, 2), nullable=False)
    threshold_value = db.Column(db.Numeric(10, 2), nullable=False)
    severity = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='active')  # 'active', 'acknowledged', 'ignored', 'resolved'
    message = db.Column(db.Text, nullable=False)
    first_triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    acknowledged_at = db.Column(db.DateTime)
    acknowledged_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    resolved_at = db.Column(db.DateTime)
    
    # 关联关系
    notifications = db.relationship('AlertNotification', backref='alert_record', lazy='dynamic', cascade='all, delete-orphan')
    host = db.relationship('SSHHost', backref='alert_records')
    
    def acknowledge(self, user_id):
        """确认告警"""
        if self.status == 'active':
            self.status = 'acknowledged'
            self.acknowledged_at = datetime.utcnow()
            self.acknowledged_by = user_id
            return True
        return False
    
    def ignore(self):
        """忽略告警"""
        if self.status in ['active', 'acknowledged']:
            self.status = 'ignored'
            return True
        return False
    
    def resolve(self):
        """解决告警"""
        if self.status in ['active', 'acknowledged']:
            self.status = 'resolved'
            self.resolved_at = datetime.utcnow()
            return True
        return False
    
    def is_active(self):
        """检查告警是否处于活跃状态"""
        return self.status == 'active'
    
    def is_acknowledged(self):
        """检查告警是否已确认"""
        return self.status == 'acknowledged'
    
    def is_resolved(self):
        """检查告警是否已解决"""
        return self.status == 'resolved'
    
    def update_last_triggered(self):
        """更新最后触发时间"""
        self.last_triggered_at = datetime.utcnow()
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'rule_id': self.rule_id,
            'rule_name': self.rule.name if self.rule else None,
            'host_id': self.host_id,
            'host_name': self.host.name if self.host else None,
            'metric_type': self.metric_type,
            'current_value': float(self.current_value) if self.current_value else None,
            'threshold_value': float(self.threshold_value) if self.threshold_value else None,
            'severity': self.severity,
            'status': self.status,
            'message': self.message,
            'first_triggered_at': self.first_triggered_at.isoformat() if self.first_triggered_at else None,
            'last_triggered_at': self.last_triggered_at.isoformat() if self.last_triggered_at else None,
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            'acknowledged_by': self.acknowledged_by,
            'acknowledger_name': self.acknowledger.username if self.acknowledger else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'duration': self._calculate_duration()
        })
        return result
    
    def _calculate_duration(self):
        """计算告警持续时长（秒）"""
        end_time = self.resolved_at or datetime.utcnow()
        if self.first_triggered_at:
            return int((end_time - self.first_triggered_at).total_seconds())
        return None
    
    def __repr__(self):
        return f'<AlertRecord {self.rule_id} {self.status}>'


class AlertNotification(BaseModel):
    """告警通知记录模型"""
    __tablename__ = 'alert_notifications'
    
    alert_record_id = db.Column(db.Integer, db.ForeignKey('alert_records.id'), nullable=False)
    channel_id = db.Column(db.Integer, db.ForeignKey('alert_channels.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # 'pending', 'sent', 'failed'
    sent_at = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'alert_record_id': self.alert_record_id,
            'channel_id': self.channel_id,
            'channel_name': self.channel.name if self.channel else None,
            'status': self.status,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'error_message': self.error_message
        })
        return result
    
    def __repr__(self):
        return f'<AlertNotification {self.alert_record_id} {self.status}>'
"""
网络探测相关模型
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel


class NetworkProbeGroup(BaseModel):
    """网络探测分组模型"""
    __tablename__ = 'network_probe_groups'
    
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    is_default = db.Column(db.Boolean, default=False)  # 标识是否为"未分组"默认分组
    is_system = db.Column(db.Boolean, default=False)  # 标识是否为系统分组（不可删除）
    color = db.Column(db.String(7), default='#1890ff')  # 分组颜色标识
    sort_order = db.Column(db.Integer, default=0)  # 排序顺序
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 关联关系
    network_probes = db.relationship('NetworkProbe', backref='group', lazy='dynamic', cascade='all, delete-orphan')
    
    # 唯一约束
    __table_args__ = (db.UniqueConstraint('tenant_id', 'name', name='unique_tenant_group_name'),)
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'name': self.name,
            'description': self.description,
            'is_default': self.is_default,
            'is_system': self.is_system,
            'color': self.color,
            'sort_order': self.sort_order,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None,
            'probe_count': self.network_probes.count()
        })
        return result
    
    def __repr__(self):
        return f'<NetworkProbeGroup {self.name}>'


class NetworkProbe(BaseModel):
    """网络探测任务模型"""
    __tablename__ = 'network_probes'
    
    group_id = db.Column(db.Integer, db.ForeignKey('network_probe_groups.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    protocol = db.Column(db.String(20), nullable=False)  # 'http', 'https', 'websocket', 'tcp', 'udp'
    target_url = db.Column(db.String(500), nullable=False)
    method = db.Column(db.String(10), default='GET')  # 'GET', 'POST' (for HTTP/HTTPS)
    headers = db.Column(db.JSON)  # HTTP 请求头
    body = db.Column(db.Text)  # HTTP 请求体
    timeout = db.Column(db.Integer, default=30)  # 超时时间（秒）
    interval_seconds = db.Column(db.Integer, default=60)  # 自动探测间隔（秒）
    auto_probe_enabled = db.Column(db.Boolean, default=False)  # 是否启用自动探测
    enabled = db.Column(db.Boolean, default=True)  # 任务是否启用
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 关联关系
    probe_results = db.relationship('NetworkProbeResult', backref='probe', lazy='dynamic', cascade='all, delete-orphan')
    alert_rules = db.relationship('NetworkAlertRule', backref='probe', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'group_id': self.group_id,
            'group_name': self.group.name if self.group else None,
            'name': self.name,
            'description': self.description,
            'protocol': self.protocol,
            'target_url': self.target_url,
            'method': self.method,
            'headers': self.headers or {},
            'body': self.body,
            'timeout': self.timeout,
            'interval_seconds': self.interval_seconds,
            'auto_probe_enabled': self.auto_probe_enabled,
            'enabled': self.enabled,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None,
            'last_result': self._get_last_result()
        })
        return result
    
    def _get_last_result(self):
        """获取最近的探测结果，并检查是否过期"""
        from datetime import datetime, timedelta
        
        last_result = self.probe_results.order_by(NetworkProbeResult.probed_at.desc()).first()
        if not last_result:
            return None
        
        result_dict = last_result.to_dict()
        
        # 检查探测结果是否过期
        # Redis 缓存 TTL 是 180 秒，如果超过这个时间没有新的探测结果，标记为未知
        PROBE_RESULT_TTL = 180  # 与 Redis TTL 保持一致
        
        if last_result.probed_at:
            time_since_last_probe = datetime.utcnow() - last_result.probed_at
            
            if time_since_last_probe.total_seconds() > PROBE_RESULT_TTL:
                result_dict['status'] = 'unknown'  # 改为 unknown
                result_dict['is_expired'] = True
            else:
                result_dict['is_expired'] = False
        else:
            result_dict['is_expired'] = False
        
        return result_dict
    
    def __repr__(self):
        return f'<NetworkProbe {self.name}>'


class NetworkProbeResult(BaseModel):
    """网络探测结果模型"""
    __tablename__ = 'network_probe_results'
    
    probe_id = db.Column(db.Integer, db.ForeignKey('network_probes.id'), nullable=False)
    probe_type = db.Column(db.String(20), nullable=False)  # 'manual', 'auto' 探测类型
    status = db.Column(db.String(20), nullable=False)  # 'success', 'failed', 'timeout'
    response_time = db.Column(db.Integer)  # 响应时间（毫秒）
    status_code = db.Column(db.Integer)  # HTTP 状态码
    response_body = db.Column(db.Text)  # 响应内容（截取前1000字符）
    error_message = db.Column(db.Text)
    probed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """转换为字典格式"""
        from datetime import datetime, timedelta
        
        result = super().to_dict()
        
        # 检查探测结果是否过期
        # Redis 缓存 TTL 是 180 秒，如果超过这个时间没有新的探测结果，标记为未知
        PROBE_RESULT_TTL = 180  # 与 Redis TTL 保持一致
        
        status = self.status
        is_expired = False
        
        if self.probed_at:
            time_since_last_probe = datetime.utcnow() - self.probed_at
            
            if time_since_last_probe.total_seconds() > PROBE_RESULT_TTL:
                status = 'unknown'  # 改为 unknown
                is_expired = True
        
        result.update({
            'probe_id': self.probe_id,
            'probe_name': self.probe.name if self.probe else None,
            'probe_type': self.probe_type,
            'status': status,  # 使用计算后的状态
            'response_time': self.response_time,
            'status_code': self.status_code,
            'response_body': self.response_body,
            'error_message': self.error_message,
            'probed_at': self.probed_at.isoformat() if self.probed_at else None,
            'is_expired': is_expired  # 添加过期标识
        })
        return result
    
    def __repr__(self):
        return f'<NetworkProbeResult {self.probe_id} {self.status}>'


class NetworkAlertRule(BaseModel):
    """网络探测告警规则模型"""
    __tablename__ = 'network_alert_rules'
    
    probe_id = db.Column(db.Integer, db.ForeignKey('network_probes.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    condition_type = db.Column(db.String(50), nullable=False)  # 'response_time', 'status_code', 'availability'
    condition_operator = db.Column(db.String(10), nullable=False)  # '>', '<', '>=', '<=', '==', '!='
    threshold_value = db.Column(db.Numeric(10, 2))
    consecutive_failures = db.Column(db.Integer, default=3)  # 连续失败次数
    channel_ids = db.Column(db.JSON, nullable=False)  # 告警渠道 ID 数组
    enabled = db.Column(db.Boolean, default=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # 关联关系
    alert_records = db.relationship('NetworkAlertRecord', backref='rule', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'probe_id': self.probe_id,
            'probe_name': self.probe.name if self.probe else None,
            'name': self.name,
            'condition_type': self.condition_type,
            'condition_operator': self.condition_operator,
            'threshold_value': float(self.threshold_value) if self.threshold_value else None,
            'consecutive_failures': self.consecutive_failures,
            'channel_ids': self.channel_ids or [],
            'enabled': self.enabled,
            'created_by': self.created_by,
            'creator_name': self.creator.username if self.creator else None
        })
        return result
    
    def __repr__(self):
        return f'<NetworkAlertRule {self.name}>'


class NetworkAlertRecord(BaseModel):
    """网络探测告警记录模型"""
    __tablename__ = 'network_alert_records'
    
    rule_id = db.Column(db.Integer, db.ForeignKey('network_alert_rules.id'), nullable=False)
    probe_id = db.Column(db.Integer, db.ForeignKey('network_probes.id'), nullable=False)
    status = db.Column(db.String(20), default='active')  # 'active', 'acknowledged', 'resolved'
    message = db.Column(db.Text, nullable=False)
    triggered_value = db.Column(db.Numeric(10, 2))
    first_triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_triggered_at = db.Column(db.DateTime, default=datetime.utcnow)
    acknowledged_at = db.Column(db.DateTime)
    acknowledged_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    resolved_at = db.Column(db.DateTime)
    
    # 关联关系
    probe = db.relationship('NetworkProbe', foreign_keys=[probe_id], backref='alert_records')
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'rule_id': self.rule_id,
            'rule_name': self.rule.name if self.rule else None,
            'probe_id': self.probe_id,
            'probe_name': self.probe.name if self.probe else None,
            'status': self.status,
            'message': self.message,
            'triggered_value': float(self.triggered_value) if self.triggered_value else None,
            'first_triggered_at': self.first_triggered_at.isoformat() if self.first_triggered_at else None,
            'last_triggered_at': self.last_triggered_at.isoformat() if self.last_triggered_at else None,
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None,
            'acknowledged_by': self.acknowledged_by,
            'acknowledger_name': None,  # Will be loaded separately if needed
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
        return f'<NetworkAlertRecord {self.rule_id} {self.status}>'
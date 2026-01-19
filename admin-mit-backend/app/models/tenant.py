"""
租户模型
"""
from datetime import datetime
from app.extensions import db


class Tenant(db.Model):
    """租户模型"""
    __tablename__ = 'tenants'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(50), unique=True, nullable=False)
    status = db.Column(db.Integer, default=1)  # 1: 活跃, 0: 禁用
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # 关联关系
    users = db.relationship('User', backref='tenant', lazy='dynamic')
    roles = db.relationship('Role', backref='tenant', lazy='dynamic')
    menus = db.relationship('Menu', backref='tenant', lazy='dynamic')
    operation_logs = db.relationship('OperationLog', backref='tenant', lazy='dynamic')
    ssh_hosts = db.relationship('SSHHost', backref='tenant', lazy='dynamic')
    ansible_playbooks = db.relationship('AnsiblePlaybook', backref='tenant', lazy='dynamic')
    playbook_executions = db.relationship('PlaybookExecution', backref='tenant', lazy='dynamic')
    alert_channels = db.relationship('AlertChannel', backref='tenant', lazy='dynamic')
    alert_rules = db.relationship('AlertRule', backref='tenant', lazy='dynamic')
    alert_records = db.relationship('AlertRecord', backref='tenant', lazy='dynamic')
    alert_notifications = db.relationship('AlertNotification', backref='tenant', lazy='dynamic')
    network_probe_groups = db.relationship('NetworkProbeGroup', backref='tenant', lazy='dynamic')
    network_probes = db.relationship('NetworkProbe', backref='tenant', lazy='dynamic')
    network_probe_results = db.relationship('NetworkProbeResult', backref='tenant', lazy='dynamic')
    network_alert_rules = db.relationship('NetworkAlertRule', backref='tenant', lazy='dynamic')
    network_alert_records = db.relationship('NetworkAlertRecord', backref='tenant', lazy='dynamic')
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<Tenant {self.name}>'
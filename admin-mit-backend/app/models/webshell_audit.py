"""
WebShell 审计日志和命令过滤规则模型
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel


# 默认黑名单命令
DEFAULT_BLACKLIST = [
    'rm', 'rmdir', 'rm -rf', 'rm -r',
    'reboot', 'shutdown', 'poweroff', 'halt', 'init',
    'dd', 'mkfs', 'mkfs.*', 'fdisk', 'parted',
    'kill', 'killall', 'pkill',
    'chmod 777', 'chown',
    'wget', 'curl -o', 'curl -O',
    '> /dev/sda', '> /dev/null',
    'format', 'del /f', 'deltree',
    'iptables -F', 'iptables -X',
    'passwd', 'useradd', 'userdel', 'usermod',
    'visudo', 'sudoers',
]


class WebShellAuditLog(BaseModel):
    """WebShell 审计日志模型"""
    __tablename__ = 'webshell_audit_logs'
    
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    host_id = db.Column(db.Integer, db.ForeignKey('ssh_hosts.id'), nullable=False)
    session_id = db.Column(db.String(100))  # WebShell 会话 ID
    command = db.Column(db.Text, nullable=False)  # 执行的命令
    status = db.Column(db.String(20), nullable=False)  # 'success', 'blocked', 'failed'
    output_summary = db.Column(db.Text)  # 输出摘要（截断到 10000 字符）
    error_message = db.Column(db.Text)  # 错误信息
    block_reason = db.Column(db.String(255))  # 阻止原因
    ip_address = db.Column(db.String(45))  # 客户端 IP (支持 IPv6)
    execution_time = db.Column(db.Float)  # 执行时间（秒）
    executed_at = db.Column(db.DateTime(timezone=True), default=datetime.utcnow)
    
    # 关联关系
    user = db.relationship('User', backref=db.backref('webshell_audit_logs', lazy='dynamic'))
    host = db.relationship('SSHHost', backref=db.backref('webshell_audit_logs', lazy='dynamic'))
    
    # 索引优化查询
    __table_args__ = (
        db.Index('idx_audit_host_date', 'host_id', 'executed_at'),
        db.Index('idx_audit_user_date', 'user_id', 'executed_at'),
        db.Index('idx_audit_status', 'status'),
        db.Index('idx_audit_tenant_date', 'tenant_id', 'executed_at'),
    )
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'host_id': self.host_id,
            'hostname': self.host.hostname if self.host else None,
            'host_name': self.host.name if self.host else None,
            'session_id': self.session_id,
            'command': self.command,
            'status': self.status,
            'output_summary': self.output_summary,
            'error_message': self.error_message,
            'block_reason': self.block_reason,
            'ip_address': self.ip_address,
            'execution_time': self.execution_time,
            'executed_at': self.executed_at.isoformat() if self.executed_at else None,
        })
        return result
    
    def __repr__(self):
        return f'<WebShellAuditLog user_id={self.user_id} host_id={self.host_id} status={self.status}>'


class CommandFilterRule(BaseModel):
    """命令过滤规则模型"""
    __tablename__ = 'command_filter_rules'
    
    host_id = db.Column(db.Integer, db.ForeignKey('ssh_hosts.id'), nullable=True)  # NULL 表示全局规则
    mode = db.Column(db.String(20), nullable=False, default='blacklist')  # 'whitelist' or 'blacklist'
    whitelist = db.Column(db.JSON, default=list)  # 白名单命令列表
    blacklist = db.Column(db.JSON, default=list)  # 黑名单命令列表
    is_active = db.Column(db.Boolean, default=True)
    
    # 关联关系
    host = db.relationship('SSHHost', backref=db.backref('command_filter_rule', uselist=False))
    
    # 唯一约束：每个租户下每个主机只能有一条规则（host_id 为 NULL 时表示全局规则）
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'host_id', name='uq_filter_rule_tenant_host'),
    )
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'host_id': self.host_id,
            'host_name': self.host.name if self.host else None,
            'mode': self.mode,
            'whitelist': self.whitelist or [],
            'blacklist': self.blacklist or [],
            'is_active': self.is_active,
        })
        return result
    
    def __repr__(self):
        host_info = f'host_id={self.host_id}' if self.host_id else 'global'
        return f'<CommandFilterRule {host_info} mode={self.mode}>'

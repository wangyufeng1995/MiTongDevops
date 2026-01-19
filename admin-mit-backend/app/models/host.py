"""
主机运维相关模型
"""
from datetime import datetime
from app.extensions import db
from .base import BaseModel


class HostGroup(BaseModel):
    """主机分组模型"""
    __tablename__ = 'host_groups'
    
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    
    # 关联关系
    hosts = db.relationship('SSHHost', backref='group', lazy='dynamic')
    
    # 唯一约束：同一租户下分组名称唯一
    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'name', name='uq_host_group_tenant_name'),
    )
    
    @property
    def host_count(self):
        """获取分组内主机数量"""
        return self.hosts.count()
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'name': self.name,
            'description': self.description,
            'host_count': self.host_count
        })
        return result
    
    def __repr__(self):
        return f'<HostGroup {self.name}>'


class SSHHost(BaseModel):
    """SSH 主机模型"""
    __tablename__ = 'ssh_hosts'
    
    name = db.Column(db.String(100), nullable=False)
    hostname = db.Column(db.String(255), nullable=False)
    port = db.Column(db.Integer, default=22)
    username = db.Column(db.String(100), nullable=False)
    auth_type = db.Column(db.String(20), nullable=False)  # 'password' or 'key'
    password = db.Column(db.String(255))  # 加密存储
    private_key = db.Column(db.Text)  # 加密存储
    description = db.Column(db.Text)
    os_type = db.Column(db.String(100))  # 操作系统类型（用户填写）
    status = db.Column(db.Integer, default=1)  # 1: 活跃, 0: 禁用
    last_connected_at = db.Column(db.DateTime)
    
    # 分组关联
    group_id = db.Column(db.Integer, db.ForeignKey('host_groups.id'), nullable=True)
    
    # 探测状态字段
    last_probe_status = db.Column(db.String(20))  # 'success', 'failed', 'pending', None
    last_probe_at = db.Column(db.DateTime)
    last_probe_message = db.Column(db.Text)
    
    # 关联关系
    host_info = db.relationship('HostInfo', backref='host', uselist=False, cascade='all, delete-orphan')
    host_metrics = db.relationship('HostMetrics', backref='host', lazy='dynamic', cascade='all, delete-orphan')
    probe_results = db.relationship('HostProbeResult', backref='host', lazy='dynamic', cascade='all, delete-orphan')
    
    def to_dict(self, include_sensitive=False):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'name': self.name,
            'hostname': self.hostname,
            'port': self.port,
            'username': self.username,
            'auth_type': self.auth_type,
            'description': self.description,
            'os_type': self.os_type,
            'status': self.status,
            'last_connected_at': self.last_connected_at.isoformat() if self.last_connected_at else None,
            'host_info': self.host_info.to_dict() if self.host_info else None,
            'group_id': self.group_id,
            'group': self.group.to_dict() if self.group else None,
            'last_probe_status': self.last_probe_status,
            'last_probe_at': self.last_probe_at.isoformat() if self.last_probe_at else None,
            'last_probe_message': self.last_probe_message
        })
        
        # 移除敏感信息
        if not include_sensitive:
            result.pop('password', None)
            result.pop('private_key', None)
        else:
            result.update({
                'password': self.password,
                'private_key': self.private_key
            })
        
        return result
    
    def __repr__(self):
        return f'<SSHHost {self.name}>'


class HostInfo(db.Model):
    """主机信息模型"""
    __tablename__ = 'host_info'
    
    id = db.Column(db.Integer, primary_key=True)
    host_id = db.Column(db.Integer, db.ForeignKey('ssh_hosts.id'), nullable=False)
    os_name = db.Column(db.String(100))
    os_version = db.Column(db.String(100))
    kernel_version = db.Column(db.String(100))
    cpu_cores = db.Column(db.Integer)
    total_memory = db.Column(db.BigInteger)  # 单位：字节
    disk_total = db.Column(db.BigInteger)  # 单位：字节
    network_interfaces = db.Column(db.JSON)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'host_id': self.host_id,
            'os_name': self.os_name,
            'os_version': self.os_version,
            'kernel_version': self.kernel_version,
            'cpu_cores': self.cpu_cores,
            'total_memory': self.total_memory,
            'disk_total': self.disk_total,
            'network_interfaces': self.network_interfaces,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<HostInfo host_id={self.host_id}>'


class HostMetrics(db.Model):
    """主机性能指标模型"""
    __tablename__ = 'host_metrics'
    
    id = db.Column(db.Integer, primary_key=True)
    host_id = db.Column(db.Integer, db.ForeignKey('ssh_hosts.id'), nullable=False)
    cpu_usage = db.Column(db.Numeric(5, 2))  # CPU 使用率
    memory_usage = db.Column(db.Numeric(5, 2))  # 内存使用率
    disk_usage = db.Column(db.Numeric(5, 2))  # 磁盘使用率
    network_in = db.Column(db.BigInteger)  # 网络入流量
    network_out = db.Column(db.BigInteger)  # 网络出流量
    load_average = db.Column(db.Numeric(5, 2))  # 系统负载
    collected_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'host_id': self.host_id,
            'cpu_usage': float(self.cpu_usage) if self.cpu_usage else None,
            'memory_usage': float(self.memory_usage) if self.memory_usage else None,
            'disk_usage': float(self.disk_usage) if self.disk_usage else None,
            'network_in': self.network_in,
            'network_out': self.network_out,
            'load_average': float(self.load_average) if self.load_average else None,
            'collected_at': self.collected_at.isoformat() if self.collected_at else None
        }
    
    def __repr__(self):
        return f'<HostMetrics host_id={self.host_id} collected_at={self.collected_at}>'


class HostProbeResult(db.Model):
    """主机探测结果模型"""
    __tablename__ = 'host_probe_results'
    
    id = db.Column(db.Integer, primary_key=True)
    host_id = db.Column(db.Integer, db.ForeignKey('ssh_hosts.id'), nullable=False)
    task_id = db.Column(db.String(100))  # Celery task ID
    status = db.Column(db.String(20), nullable=False)  # 'success', 'failed', 'timeout'
    message = db.Column(db.Text)
    ansible_output = db.Column(db.Text)
    response_time = db.Column(db.Float)  # 响应时间（秒）
    probed_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """转换为字典格式"""
        return {
            'id': self.id,
            'host_id': self.host_id,
            'task_id': self.task_id,
            'status': self.status,
            'message': self.message,
            'ansible_output': self.ansible_output,
            'response_time': self.response_time,
            'probed_at': self.probed_at.isoformat() if self.probed_at else None
        }
    
    def __repr__(self):
        return f'<HostProbeResult host_id={self.host_id} status={self.status}>'

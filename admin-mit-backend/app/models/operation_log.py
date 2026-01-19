"""
操作日志模型
"""
from app.extensions import db
from .base import BaseModel


class OperationLog(BaseModel):
    """操作日志模型"""
    __tablename__ = 'operation_logs'
    
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # 操作类型：create, update, delete, login, logout
    resource = db.Column(db.String(50), nullable=False)  # 资源类型：user, role, menu, host, etc.
    resource_id = db.Column(db.Integer)  # 资源ID
    details = db.Column(db.JSON)  # 操作详情
    ip_address = db.Column(db.String(45))  # IP地址（支持IPv6）
    user_agent = db.Column(db.Text)  # 用户代理
    
    def to_dict(self):
        """转换为字典格式"""
        result = super().to_dict()
        result.update({
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'action': self.action,
            'resource': self.resource,
            'resource_id': self.resource_id,
            'details': self.details,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent
        })
        return result
    
    @classmethod
    def log_operation(cls, tenant_id, user_id, action, resource, resource_id=None, 
                     details=None, ip_address=None, user_agent=None):
        """记录操作日志"""
        log = cls(
            tenant_id=tenant_id,
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.session.add(log)
        return log
    
    def __repr__(self):
        return f'<OperationLog {self.action} {self.resource}>'
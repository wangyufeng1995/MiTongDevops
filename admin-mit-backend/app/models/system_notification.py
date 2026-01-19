"""
系统通知数据模型
"""
from datetime import datetime
from app.extensions import db
from app.models.base import BaseModel


class SystemNotification(BaseModel):
    """系统通知模型"""
    __tablename__ = 'system_notifications'

    # 注意：id, tenant_id, created_at, updated_at 继承自 BaseModel
    
    # 通知基本信息
    title = db.Column(db.String(200), nullable=False, comment='通知标题')
    message = db.Column(db.Text, nullable=False, comment='通知内容')
    type = db.Column(db.String(50), nullable=False, default='info', comment='通知类型: info, success, warning, error')
    category = db.Column(db.String(50), nullable=False, default='system', comment='通知分类: system, alert, task, security')
    
    # 通知状态
    is_read = db.Column(db.Boolean, default=False, comment='是否已读')
    is_global = db.Column(db.Boolean, default=False, comment='是否全局通知')
    
    # 目标用户
    target_user_id = db.Column(db.Integer, nullable=True, comment='目标用户ID，为空表示全局通知')
    
    # 关联信息
    related_type = db.Column(db.String(50), nullable=True, comment='关联类型: host, playbook, alert, probe')
    related_id = db.Column(db.Integer, nullable=True, comment='关联对象ID')
    
    # 时间信息（created_at 继承自 BaseModel）
    read_at = db.Column(db.DateTime, nullable=True, comment='阅读时间')
    expires_at = db.Column(db.DateTime, nullable=True, comment='过期时间')

    def to_dict(self):
        """转换为字典"""
        return {
            'id': self.id,
            'tenant_id': self.tenant_id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'category': self.category,
            'is_read': self.is_read,
            'is_global': self.is_global,
            'target_user_id': self.target_user_id,
            'related_type': self.related_type,
            'related_id': self.related_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'time_ago': self._get_time_ago()
        }

    def _get_time_ago(self):
        """获取相对时间"""
        if not self.created_at:
            return ''
        
        now = datetime.utcnow()
        diff = now - self.created_at
        
        if diff.days > 0:
            return f'{diff.days}天前'
        elif diff.seconds >= 3600:
            hours = diff.seconds // 3600
            return f'{hours}小时前'
        elif diff.seconds >= 60:
            minutes = diff.seconds // 60
            return f'{minutes}分钟前'
        else:
            return '刚刚'

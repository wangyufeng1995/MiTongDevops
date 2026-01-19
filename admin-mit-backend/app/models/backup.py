"""
备份记录模型
"""
from datetime import datetime
from app.extensions import db
from app.models.base import BaseModel


class BackupRecord(BaseModel):
    """备份记录表"""
    __tablename__ = 'backup_records'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False, index=True)
    
    # 备份信息
    filename = db.Column(db.String(255), nullable=False, comment='备份文件名')
    filepath = db.Column(db.String(500), nullable=False, comment='备份文件完整路径')
    category = db.Column(db.String(50), nullable=False, comment='备份类型: database/network')
    backup_type = db.Column(db.String(20), nullable=False, default='manual', comment='备份方式: auto/manual')
    
    # 文件信息
    file_size = db.Column(db.BigInteger, nullable=True, comment='文件大小(字节)')
    file_size_display = db.Column(db.String(50), nullable=True, comment='文件大小显示')
    compression = db.Column(db.Boolean, default=True, comment='是否压缩')
    
    # 状态信息
    status = db.Column(db.String(20), nullable=False, default='success', comment='状态: success/failed/deleted')
    message = db.Column(db.Text, nullable=True, comment='备份消息或错误信息')
    
    # 数据库备份特有字段
    db_host = db.Column(db.String(255), nullable=True, comment='数据库主机')
    db_name = db.Column(db.String(255), nullable=True, comment='数据库名')
    
    # 时间信息
    created_at = db.Column(db.DateTime, default=datetime.utcnow, comment='创建时间')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, comment='创建人')
    deleted_at = db.Column(db.DateTime, nullable=True, comment='删除时间')
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'filepath': self.filepath,
            'category': self.category,
            'type': self.backup_type,
            'size': self.file_size_display or self._format_size(self.file_size),
            'file_size': self.file_size,
            'compression': self.compression,
            'status': self.status,
            'message': self.message,
            'db_host': self.db_host,
            'db_name': self.db_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by
        }
    
    @staticmethod
    def _format_size(size_bytes):
        if not size_bytes:
            return '0 B'
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024:
                return f'{size_bytes:.2f} {unit}'
            size_bytes /= 1024
        return f'{size_bytes:.2f} TB'
    
    @classmethod
    def query_by_tenant(cls, tenant_id):
        return cls.query.filter(
            cls.tenant_id == tenant_id,
            cls.status != 'deleted'
        )

"""添加备份记录表

Revision ID: 005_add_backup_records
Revises: 004_add_webshell_audit_tables
Create Date: 2026-01-12
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '005_add_backup_records'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    """创建 backup_records 表"""
    op.create_table(
        'backup_records',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False, index=True),
        
        # 备份信息
        sa.Column('filename', sa.String(255), nullable=False, comment='备份文件名'),
        sa.Column('filepath', sa.String(500), nullable=False, comment='备份文件完整路径'),
        sa.Column('category', sa.String(50), nullable=False, comment='备份类型: database/network'),
        sa.Column('backup_type', sa.String(20), nullable=False, server_default='manual', comment='备份方式: auto/manual'),
        
        # 文件信息
        sa.Column('file_size', sa.BigInteger(), nullable=True, comment='文件大小(字节)'),
        sa.Column('file_size_display', sa.String(50), nullable=True, comment='文件大小显示'),
        sa.Column('compression', sa.Boolean(), server_default='true', comment='是否压缩'),
        
        # 状态信息
        sa.Column('status', sa.String(20), nullable=False, server_default='success', comment='状态: success/failed/deleted'),
        sa.Column('message', sa.Text(), nullable=True, comment='备份消息或错误信息'),
        
        # 数据库备份特有字段
        sa.Column('db_host', sa.String(255), nullable=True, comment='数据库主机'),
        sa.Column('db_name', sa.String(255), nullable=True, comment='数据库名'),
        
        # 时间信息
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), comment='创建时间'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True, comment='创建人'),
        sa.Column('deleted_at', sa.DateTime(), nullable=True, comment='删除时间'),
    )
    
    # 创建索引
    op.create_index('ix_backup_records_category', 'backup_records', ['category'])
    op.create_index('ix_backup_records_status', 'backup_records', ['status'])
    op.create_index('ix_backup_records_created_at', 'backup_records', ['created_at'])


def downgrade():
    """删除 backup_records 表"""
    op.drop_index('ix_backup_records_created_at', table_name='backup_records')
    op.drop_index('ix_backup_records_status', table_name='backup_records')
    op.drop_index('ix_backup_records_category', table_name='backup_records')
    op.drop_table('backup_records')

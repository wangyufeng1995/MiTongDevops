"""添加 Redis 连接配置表

Revision ID: 006_add_redis_connections
Revises: 005_add_backup_records
Create Date: 2026-01-12
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '006_add_redis_connections'
down_revision = '005_add_backup_records'
branch_labels = None
depends_on = None


def upgrade():
    """创建 redis_connections 表"""
    op.create_table(
        'redis_connections',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        
        # 连接基本信息
        sa.Column('name', sa.String(100), nullable=False, comment='连接名称'),
        sa.Column('connection_type', sa.String(20), nullable=False, server_default='standalone', 
                  comment='连接类型: standalone/cluster'),
        
        # 单机模式配置
        sa.Column('host', sa.String(255), nullable=True, comment='主机地址 (单机模式)'),
        sa.Column('port', sa.Integer(), server_default='6379', comment='端口 (单机模式)'),
        sa.Column('database', sa.Integer(), server_default='0', comment='数据库索引 (单机模式, 0-15)'),
        
        # 集群模式配置
        sa.Column('cluster_nodes', sa.Text(), nullable=True, comment='集群节点列表 (JSON格式)'),
        
        # 认证和连接配置
        sa.Column('password', sa.Text(), nullable=True, comment='密码 (加密存储)'),
        sa.Column('timeout', sa.Integer(), server_default='5', comment='连接超时 (秒)'),
        
        # 其他信息
        sa.Column('description', sa.Text(), nullable=True, comment='描述'),
        sa.Column('status', sa.Integer(), server_default='1', comment='状态: 0-禁用, 1-启用'),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, comment='创建时间'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), 
                  nullable=False, comment='更新时间'),
    )
    
    # 创建索引 (tenant_id, name)
    op.create_index('ix_redis_connections_tenant_id', 'redis_connections', ['tenant_id'])
    op.create_index('ix_redis_connections_name', 'redis_connections', ['name'])
    
    # 创建唯一约束 (tenant_id, name) - 同一租户下连接名称唯一
    op.create_unique_constraint('uq_redis_connection_tenant_name', 'redis_connections', ['tenant_id', 'name'])


def downgrade():
    """删除 redis_connections 表"""
    op.drop_constraint('uq_redis_connection_tenant_name', 'redis_connections', type_='unique')
    op.drop_index('ix_redis_connections_name', table_name='redis_connections')
    op.drop_index('ix_redis_connections_tenant_id', table_name='redis_connections')
    op.drop_table('redis_connections')

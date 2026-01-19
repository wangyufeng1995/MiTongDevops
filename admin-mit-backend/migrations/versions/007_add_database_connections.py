"""添加数据库连接配置表

Revision ID: 007_add_database_connections
Revises: 006_add_redis_connections
Create Date: 2026-01-12

支持 PostgreSQL、MySQL、达梦DM、Oracle 四种数据库类型。
Requirements: 1.6
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '007_add_database_connections'
down_revision = '006_add_redis_connections'
branch_labels = None
depends_on = None


def upgrade():
    """创建 database_connections 表"""
    op.create_table(
        'database_connections',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        
        # 基本信息
        sa.Column('name', sa.String(100), nullable=False, comment='连接名称'),
        sa.Column('db_type', sa.String(20), nullable=False, 
                  comment='数据库类型: postgresql/mysql/dm/oracle'),
        
        # 连接参数
        sa.Column('host', sa.String(255), nullable=False, comment='主机地址'),
        sa.Column('port', sa.Integer(), nullable=False, comment='端口号'),
        sa.Column('username', sa.String(100), nullable=False, comment='用户名'),
        sa.Column('password', sa.Text(), nullable=True, comment='密码（加密存储）'),
        sa.Column('database', sa.String(100), nullable=True, comment='数据库名'),
        sa.Column('schema', sa.String(100), nullable=True, comment='Schema名称'),
        
        # Oracle 特定参数
        sa.Column('service_name', sa.String(100), nullable=True, comment='Oracle Service Name'),
        sa.Column('sid', sa.String(100), nullable=True, comment='Oracle SID'),
        
        # 其他配置
        sa.Column('timeout', sa.Integer(), server_default='10', comment='连接超时（秒）'),
        sa.Column('description', sa.Text(), nullable=True, comment='描述'),
        sa.Column('status', sa.Integer(), server_default='1', comment='状态: 0-禁用, 1-启用'),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, 
                  comment='创建时间'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), 
                  nullable=False, comment='更新时间'),
    )
    
    # 创建索引
    op.create_index('idx_database_connections_tenant', 'database_connections', ['tenant_id'])
    op.create_index('idx_database_connections_type', 'database_connections', ['db_type'])
    
    # 创建唯一约束 (tenant_id, name) - 同一租户下连接名称唯一
    op.create_unique_constraint(
        'uq_database_connection_tenant_name', 
        'database_connections', 
        ['tenant_id', 'name']
    )


def downgrade():
    """删除 database_connections 表"""
    op.drop_constraint('uq_database_connection_tenant_name', 'database_connections', type_='unique')
    op.drop_index('idx_database_connections_type', table_name='database_connections')
    op.drop_index('idx_database_connections_tenant', table_name='database_connections')
    op.drop_table('database_connections')

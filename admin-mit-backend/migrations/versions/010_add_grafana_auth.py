"""添加 Grafana 认证配置字段

Revision ID: 010_add_grafana_auth
Revises: 009_datasource_grafana
Create Date: 2025-01-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '010_add_grafana_auth'
down_revision = '009_datasource_grafana'
branch_labels = None
depends_on = None


def upgrade():
    """添加 Grafana 认证配置字段"""
    
    # 添加认证配置字段
    op.add_column('grafana_configs', sa.Column('auth_type', sa.String(20), server_default='none'))
    op.add_column('grafana_configs', sa.Column('auth_username', sa.String(100), nullable=True))
    op.add_column('grafana_configs', sa.Column('auth_password', sa.String(200), nullable=True))
    op.add_column('grafana_configs', sa.Column('auth_token', sa.String(500), nullable=True))
    op.add_column('grafana_configs', sa.Column('api_key', sa.String(500), nullable=True))
    
    # 添加代理配置字段
    op.add_column('grafana_configs', sa.Column('use_proxy', sa.Boolean, server_default='1'))
    op.add_column('grafana_configs', sa.Column('allow_anonymous', sa.Boolean, server_default='0'))


def downgrade():
    """移除 Grafana 认证配置字段"""
    
    op.drop_column('grafana_configs', 'allow_anonymous')
    op.drop_column('grafana_configs', 'use_proxy')
    op.drop_column('grafana_configs', 'api_key')
    op.drop_column('grafana_configs', 'auth_token')
    op.drop_column('grafana_configs', 'auth_password')
    op.drop_column('grafana_configs', 'auth_username')
    op.drop_column('grafana_configs', 'auth_type')

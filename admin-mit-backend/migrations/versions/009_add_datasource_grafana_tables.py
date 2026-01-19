"""添加数据源和 Grafana 配置表

Revision ID: 009_datasource_grafana
Revises: 008_add_k8s_tables
Create Date: 2026-01-14

支持 Prometheus/VictoriaMetrics 数据源配置和 Grafana 仪表盘 iframe 嵌入。
Requirements: 1.7, 4.6
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '009_datasource_grafana'
down_revision = '008_add_k8s_tables'
branch_labels = None
depends_on = None


def upgrade():
    """创建数据源和 Grafana 相关表"""
    
    # ========================================
    # 1. 创建 datasource_configs 表
    # ========================================
    op.create_table(
        'datasource_configs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False,
                  comment='租户ID'),
        
        # 基本信息
        sa.Column('name', sa.String(100), nullable=False, comment='数据源名称'),
        sa.Column('type', sa.String(50), nullable=False, default='prometheus',
                  comment='数据源类型: prometheus, victoriametrics'),
        sa.Column('url', sa.String(500), nullable=False, comment='服务器 URL'),
        
        # 认证信息
        sa.Column('auth_type', sa.String(20), nullable=False, default='none',
                  comment='认证类型: none, basic, bearer'),
        sa.Column('username', sa.String(100), nullable=True, comment='用户名（Basic Auth）'),
        sa.Column('password', sa.String(500), nullable=True, comment='密码（明文存储）'),
        sa.Column('token', sa.String(1000), nullable=True, comment='Token（明文存储）'),
        
        # 状态和默认设置
        sa.Column('is_default', sa.Boolean(), default=False, comment='是否为默认数据源'),
        sa.Column('status', sa.Integer(), default=1, comment='状态: 0-禁用, 1-启用'),
        
        # 创建者
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True,
                  comment='创建者ID'),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False,
                  comment='创建时间'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(),
                  nullable=False, comment='更新时间'),
    )
    
    # 创建索引
    op.create_index('idx_datasource_configs_tenant', 'datasource_configs', ['tenant_id'])
    op.create_index('idx_datasource_configs_type', 'datasource_configs', ['type'])
    op.create_index('idx_datasource_configs_status', 'datasource_configs', ['status'])
    
    # 创建唯一约束 (tenant_id, name) - 同一租户下数据源名称唯一
    op.create_unique_constraint(
        'uq_datasource_configs_tenant_name',
        'datasource_configs',
        ['tenant_id', 'name']
    )
    
    # ========================================
    # 2. 创建 saved_promql_queries 表
    # ========================================
    op.create_table(
        'saved_promql_queries',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False,
                  comment='租户ID'),
        sa.Column('config_id', sa.Integer(), sa.ForeignKey('datasource_configs.id', ondelete='CASCADE'),
                  nullable=False, comment='数据源配置ID'),
        
        # 查询信息
        sa.Column('name', sa.String(100), nullable=False, comment='查询名称'),
        sa.Column('query', sa.Text(), nullable=False, comment='PromQL 查询语句'),
        sa.Column('description', sa.Text(), nullable=True, comment='查询描述'),
        
        # 创建者
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True,
                  comment='创建者ID'),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False,
                  comment='创建时间'),
    )
    
    # 创建索引
    op.create_index('idx_saved_promql_queries_tenant', 'saved_promql_queries', ['tenant_id'])
    op.create_index('idx_saved_promql_queries_config', 'saved_promql_queries', ['config_id'])
    
    # 创建唯一约束 (tenant_id, config_id, name) - 同一租户下同一配置的查询名称唯一
    op.create_unique_constraint(
        'uq_saved_queries_tenant_config_name',
        'saved_promql_queries',
        ['tenant_id', 'config_id', 'name']
    )
    
    # ========================================
    # 3. 创建 grafana_configs 表
    # ========================================
    op.create_table(
        'grafana_configs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False,
                  comment='租户ID'),
        
        # 基本信息
        sa.Column('name', sa.String(100), nullable=False, comment='配置名称'),
        sa.Column('url', sa.String(500), nullable=False, comment='Grafana 服务器 URL'),
        
        # 状态和显示设置
        sa.Column('status', sa.Integer(), default=1, comment='状态: 0-禁用, 1-启用'),
        sa.Column('iframe_height', sa.Integer(), default=800, comment='iframe 高度（像素）'),
        
        # 创建者
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True,
                  comment='创建者ID'),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False,
                  comment='创建时间'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(),
                  nullable=False, comment='更新时间'),
    )
    
    # 创建索引
    op.create_index('idx_grafana_configs_tenant', 'grafana_configs', ['tenant_id'])
    op.create_index('idx_grafana_configs_status', 'grafana_configs', ['status'])
    
    # 创建唯一约束 (tenant_id, name) - 同一租户下配置名称唯一
    op.create_unique_constraint(
        'uq_grafana_configs_tenant_name',
        'grafana_configs',
        ['tenant_id', 'name']
    )
    
    # ========================================
    # 4. 创建 grafana_dashboards 表
    # ========================================
    op.create_table(
        'grafana_dashboards',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('config_id', sa.Integer(), sa.ForeignKey('grafana_configs.id', ondelete='CASCADE'),
                  nullable=False, comment='Grafana 配置ID'),
        
        # 仪表盘信息
        sa.Column('name', sa.String(100), nullable=False, comment='仪表盘名称'),
        sa.Column('url', sa.String(1000), nullable=False, comment='仪表盘完整 URL'),
        sa.Column('description', sa.Text(), nullable=True, comment='仪表盘描述'),
        
        # 显示设置
        sa.Column('is_default', sa.Boolean(), default=False, comment='是否为默认仪表盘'),
        sa.Column('sort_order', sa.Integer(), default=0, comment='排序顺序'),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False,
                  comment='创建时间'),
    )
    
    # 创建索引
    op.create_index('idx_grafana_dashboards_config', 'grafana_dashboards', ['config_id'])
    op.create_index('idx_grafana_dashboards_default', 'grafana_dashboards', ['is_default'])
    op.create_index('idx_grafana_dashboards_sort', 'grafana_dashboards', ['sort_order'])
    
    # 创建唯一约束 (config_id, name) - 同一配置下仪表盘名称唯一
    op.create_unique_constraint(
        'uq_grafana_dashboards_config_name',
        'grafana_dashboards',
        ['config_id', 'name']
    )


def downgrade():
    """删除数据源和 Grafana 相关表"""
    
    # 删除 grafana_dashboards 表
    op.drop_constraint('uq_grafana_dashboards_config_name', 'grafana_dashboards', type_='unique')
    op.drop_index('idx_grafana_dashboards_sort', table_name='grafana_dashboards')
    op.drop_index('idx_grafana_dashboards_default', table_name='grafana_dashboards')
    op.drop_index('idx_grafana_dashboards_config', table_name='grafana_dashboards')
    op.drop_table('grafana_dashboards')
    
    # 删除 grafana_configs 表
    op.drop_constraint('uq_grafana_configs_tenant_name', 'grafana_configs', type_='unique')
    op.drop_index('idx_grafana_configs_status', table_name='grafana_configs')
    op.drop_index('idx_grafana_configs_tenant', table_name='grafana_configs')
    op.drop_table('grafana_configs')
    
    # 删除 saved_promql_queries 表
    op.drop_constraint('uq_saved_queries_tenant_config_name', 'saved_promql_queries', type_='unique')
    op.drop_index('idx_saved_promql_queries_config', table_name='saved_promql_queries')
    op.drop_index('idx_saved_promql_queries_tenant', table_name='saved_promql_queries')
    op.drop_table('saved_promql_queries')
    
    # 删除 datasource_configs 表
    op.drop_constraint('uq_datasource_configs_tenant_name', 'datasource_configs', type_='unique')
    op.drop_index('idx_datasource_configs_status', table_name='datasource_configs')
    op.drop_index('idx_datasource_configs_type', table_name='datasource_configs')
    op.drop_index('idx_datasource_configs_tenant', table_name='datasource_configs')
    op.drop_table('datasource_configs')

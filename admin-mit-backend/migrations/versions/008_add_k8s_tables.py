"""添加K8S集群管理表

Revision ID: 008_add_k8s_tables
Revises: 007_add_database_connections
Create Date: 2026-01-13

支持Kubernetes集群连接管理和操作审计日志。
Requirements: 1.1, 1.2, 9.5
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '008_add_k8s_tables'
down_revision = '007_add_database_connections'
branch_labels = None
depends_on = None


def upgrade():
    """创建 K8S 相关表"""
    
    # 创建 k8s_clusters 表
    op.create_table(
        'k8s_clusters',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), sa.ForeignKey('tenants.id'), nullable=False),
        
        # 基本信息
        sa.Column('name', sa.String(100), nullable=False, comment='集群名称'),
        sa.Column('api_server', sa.String(255), nullable=False, comment='API服务器地址'),
        sa.Column('auth_type', sa.String(20), nullable=False, comment='认证类型: token, kubeconfig'),
        
        # 认证信息（加密存储）
        sa.Column('token', sa.Text(), nullable=True, comment='Token（加密）'),
        sa.Column('kubeconfig', sa.Text(), nullable=True, comment='Kubeconfig（加密）'),
        
        # 描述和状态
        sa.Column('description', sa.Text(), nullable=True, comment='描述'),
        sa.Column('status', sa.String(20), nullable=True, comment='状态: online, offline, error'),
        
        # 集群信息
        sa.Column('version', sa.String(50), nullable=True, comment='K8S版本'),
        sa.Column('node_count', sa.Integer(), nullable=True, comment='节点数量'),
        sa.Column('namespace_count', sa.Integer(), nullable=True, comment='命名空间数量'),
        sa.Column('pod_count', sa.Integer(), nullable=True, comment='Pod数量'),
        
        # 时间戳
        sa.Column('last_connected_at', sa.DateTime(), nullable=True, comment='最后连接时间'),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True, comment='最后同步时间'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, 
                  comment='创建时间'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), 
                  nullable=False, comment='更新时间'),
    )
    
    # 创建索引
    op.create_index('idx_k8s_clusters_tenant', 'k8s_clusters', ['tenant_id'])
    op.create_index('idx_k8s_clusters_status', 'k8s_clusters', ['status'])
    
    # 创建唯一约束 (tenant_id, name) - 同一租户下集群名称唯一
    op.create_unique_constraint(
        'uq_k8s_cluster_tenant_name', 
        'k8s_clusters', 
        ['tenant_id', 'name']
    )
    
    # 创建 k8s_operations 表（操作审计日志）
    op.create_table(
        'k8s_operations',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.Integer(), nullable=False, comment='租户ID'),
        sa.Column('user_id', sa.Integer(), nullable=False, comment='用户ID'),
        sa.Column('cluster_id', sa.Integer(), sa.ForeignKey('k8s_clusters.id'), nullable=True, 
                  comment='集群ID'),
        
        # 操作信息
        sa.Column('operation_type', sa.String(50), nullable=False, 
                  comment='操作类型: create, update, delete, scale, restart'),
        sa.Column('resource_type', sa.String(50), nullable=False, 
                  comment='资源类型: deployment, service, configmap, etc.'),
        sa.Column('resource_name', sa.String(255), nullable=True, comment='资源名称'),
        sa.Column('namespace', sa.String(255), nullable=True, comment='命名空间'),
        
        # 操作数据和结果
        sa.Column('operation_data', sa.JSON(), nullable=True, comment='操作数据'),
        sa.Column('status', sa.String(20), nullable=False, comment='状态: success, failed'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='错误信息'),
        
        # 时间戳
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False, 
                  comment='创建时间'),
    )
    
    # 创建索引
    op.create_index('idx_k8s_operations_tenant', 'k8s_operations', ['tenant_id'])
    op.create_index('idx_k8s_operations_cluster', 'k8s_operations', ['cluster_id'])
    op.create_index('idx_k8s_operations_user', 'k8s_operations', ['user_id'])
    op.create_index('idx_k8s_operations_type', 'k8s_operations', ['operation_type'])
    op.create_index('idx_k8s_operations_created', 'k8s_operations', ['created_at'])


def downgrade():
    """删除 K8S 相关表"""
    
    # 删除 k8s_operations 表
    op.drop_index('idx_k8s_operations_created', table_name='k8s_operations')
    op.drop_index('idx_k8s_operations_type', table_name='k8s_operations')
    op.drop_index('idx_k8s_operations_user', table_name='k8s_operations')
    op.drop_index('idx_k8s_operations_cluster', table_name='k8s_operations')
    op.drop_index('idx_k8s_operations_tenant', table_name='k8s_operations')
    op.drop_table('k8s_operations')
    
    # 删除 k8s_clusters 表
    op.drop_constraint('uq_k8s_cluster_tenant_name', 'k8s_clusters', type_='unique')
    op.drop_index('idx_k8s_clusters_status', table_name='k8s_clusters')
    op.drop_index('idx_k8s_clusters_tenant', table_name='k8s_clusters')
    op.drop_table('k8s_clusters')

"""Initial migration - Create all tables

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Create tenants table
    op.create_table('tenants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('status', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    
    # Create users table
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=True),
        sa.Column('avatar_style', sa.String(length=50), nullable=True),
        sa.Column('avatar_seed', sa.String(length=100), nullable=True),
        sa.Column('avatar_config', sa.JSON(), nullable=True),
        sa.Column('status', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('username')
    )
    op.create_index(op.f('ix_users_tenant_id'), 'users', ['tenant_id'], unique=False)
    
    # Create roles table
    op.create_table('roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('permissions', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_roles_tenant_id'), 'roles', ['tenant_id'], unique=False)
    
    # Create user_roles table
    op.create_table('user_roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'role_id', name='unique_user_role')
    )
    
    # Create menus table
    op.create_table('menus',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('path', sa.String(length=100), nullable=True),
        sa.Column('component', sa.String(length=100), nullable=True),
        sa.Column('icon', sa.String(length=50), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=True),
        sa.Column('status', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['parent_id'], ['menus.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_menus_tenant_id'), 'menus', ['tenant_id'], unique=False)
    
    # Create operation_logs table
    op.create_table('operation_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('resource', sa.String(length=50), nullable=False),
        sa.Column('resource_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_operation_logs_tenant_id'), 'operation_logs', ['tenant_id'], unique=False)
    
    # Create ssh_hosts table
    op.create_table('ssh_hosts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('hostname', sa.String(length=255), nullable=False),
        sa.Column('port', sa.Integer(), nullable=True),
        sa.Column('username', sa.String(length=100), nullable=False),
        sa.Column('auth_type', sa.String(length=20), nullable=False),
        sa.Column('password', sa.String(length=255), nullable=True),
        sa.Column('private_key', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Integer(), nullable=True),
        sa.Column('last_connected_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ssh_hosts_tenant_id'), 'ssh_hosts', ['tenant_id'], unique=False)
    
    # Create host_info table
    op.create_table('host_info',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('host_id', sa.Integer(), nullable=False),
        sa.Column('os_name', sa.String(length=100), nullable=True),
        sa.Column('os_version', sa.String(length=100), nullable=True),
        sa.Column('kernel_version', sa.String(length=100), nullable=True),
        sa.Column('cpu_cores', sa.Integer(), nullable=True),
        sa.Column('total_memory', sa.BigInteger(), nullable=True),
        sa.Column('disk_total', sa.BigInteger(), nullable=True),
        sa.Column('network_interfaces', sa.JSON(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['host_id'], ['ssh_hosts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create host_metrics table
    op.create_table('host_metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('host_id', sa.Integer(), nullable=False),
        sa.Column('cpu_usage', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('memory_usage', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('disk_usage', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('network_in', sa.BigInteger(), nullable=True),
        sa.Column('network_out', sa.BigInteger(), nullable=True),
        sa.Column('load_average', sa.Numeric(precision=5, scale=2), nullable=True),
        sa.Column('collected_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['host_id'], ['ssh_hosts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create ansible_playbooks table
    op.create_table('ansible_playbooks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('variables', sa.JSON(), nullable=True),
        sa.Column('version', sa.String(length=20), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ansible_playbooks_tenant_id'), 'ansible_playbooks', ['tenant_id'], unique=False)
    
    # Create playbook_executions table
    op.create_table('playbook_executions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('playbook_id', sa.Integer(), nullable=False),
        sa.Column('host_ids', sa.JSON(), nullable=False),
        sa.Column('variables', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('output', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['playbook_id'], ['ansible_playbooks.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_playbook_executions_tenant_id'), 'playbook_executions', ['tenant_id'], unique=False) 
   
    # Create alert_channels table
    op.create_table('alert_channels',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('config', sa.JSON(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_channels_tenant_id'), 'alert_channels', ['tenant_id'], unique=False)
    
    # Create alert_rules table
    op.create_table('alert_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('metric_type', sa.String(length=50), nullable=False),
        sa.Column('condition_operator', sa.String(length=10), nullable=False),
        sa.Column('threshold_value', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('duration', sa.Integer(), nullable=True),
        sa.Column('severity', sa.String(length=20), nullable=True),
        sa.Column('host_ids', sa.JSON(), nullable=True),
        sa.Column('channel_ids', sa.JSON(), nullable=False),
        sa.Column('silence_period', sa.Integer(), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_rules_tenant_id'), 'alert_rules', ['tenant_id'], unique=False)
    
    # Create alert_records table
    op.create_table('alert_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('rule_id', sa.Integer(), nullable=False),
        sa.Column('host_id', sa.Integer(), nullable=False),
        sa.Column('metric_type', sa.String(length=50), nullable=False),
        sa.Column('current_value', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('threshold_value', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('first_triggered_at', sa.DateTime(), nullable=True),
        sa.Column('last_triggered_at', sa.DateTime(), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('acknowledged_by', sa.Integer(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['acknowledged_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['host_id'], ['ssh_hosts.id'], ),
        sa.ForeignKeyConstraint(['rule_id'], ['alert_rules.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_records_tenant_id'), 'alert_records', ['tenant_id'], unique=False)
    
    # Create alert_notifications table
    op.create_table('alert_notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('alert_record_id', sa.Integer(), nullable=False),
        sa.Column('channel_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['alert_record_id'], ['alert_records.id'], ),
        sa.ForeignKeyConstraint(['channel_id'], ['alert_channels.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_notifications_tenant_id'), 'alert_notifications', ['tenant_id'], unique=False)
    
    # Create network_probe_groups table
    op.create_table('network_probe_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=True),
        sa.Column('color', sa.String(length=7), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'name', name='unique_tenant_group_name')
    )
    op.create_index(op.f('ix_network_probe_groups_tenant_id'), 'network_probe_groups', ['tenant_id'], unique=False)
    
    # Create network_probes table
    op.create_table('network_probes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('protocol', sa.String(length=20), nullable=False),
        sa.Column('target_url', sa.String(length=500), nullable=False),
        sa.Column('method', sa.String(length=10), nullable=True),
        sa.Column('headers', sa.JSON(), nullable=True),
        sa.Column('body', sa.Text(), nullable=True),
        sa.Column('timeout', sa.Integer(), nullable=True),
        sa.Column('interval_seconds', sa.Integer(), nullable=True),
        sa.Column('auto_probe_enabled', sa.Boolean(), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['group_id'], ['network_probe_groups.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_network_probes_tenant_id'), 'network_probes', ['tenant_id'], unique=False)
    
    # Create network_probe_results table
    op.create_table('network_probe_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('probe_id', sa.Integer(), nullable=False),
        sa.Column('probe_type', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('response_time', sa.Integer(), nullable=True),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('response_body', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('probed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['probe_id'], ['network_probes.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_network_probe_results_tenant_id'), 'network_probe_results', ['tenant_id'], unique=False)
    
    # Create network_alert_rules table
    op.create_table('network_alert_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('probe_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('condition_type', sa.String(length=50), nullable=False),
        sa.Column('condition_operator', sa.String(length=10), nullable=False),
        sa.Column('threshold_value', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('consecutive_failures', sa.Integer(), nullable=True),
        sa.Column('channel_ids', sa.JSON(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['probe_id'], ['network_probes.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_network_alert_rules_tenant_id'), 'network_alert_rules', ['tenant_id'], unique=False)
    
    # Create network_alert_records table
    op.create_table('network_alert_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('rule_id', sa.Integer(), nullable=False),
        sa.Column('probe_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('triggered_value', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('first_triggered_at', sa.DateTime(), nullable=True),
        sa.Column('last_triggered_at', sa.DateTime(), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('acknowledged_by', sa.Integer(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['acknowledged_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['probe_id'], ['network_probes.id'], ),
        sa.ForeignKeyConstraint(['rule_id'], ['network_alert_rules.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_network_alert_records_tenant_id'), 'network_alert_records', ['tenant_id'], unique=False)


def downgrade():
    # Drop tables in reverse order
    op.drop_index(op.f('ix_network_alert_records_tenant_id'), table_name='network_alert_records')
    op.drop_table('network_alert_records')
    op.drop_index(op.f('ix_network_alert_rules_tenant_id'), table_name='network_alert_rules')
    op.drop_table('network_alert_rules')
    op.drop_index(op.f('ix_network_probe_results_tenant_id'), table_name='network_probe_results')
    op.drop_table('network_probe_results')
    op.drop_index(op.f('ix_network_probes_tenant_id'), table_name='network_probes')
    op.drop_table('network_probes')
    op.drop_index(op.f('ix_network_probe_groups_tenant_id'), table_name='network_probe_groups')
    op.drop_table('network_probe_groups')
    op.drop_index(op.f('ix_alert_notifications_tenant_id'), table_name='alert_notifications')
    op.drop_table('alert_notifications')
    op.drop_index(op.f('ix_alert_records_tenant_id'), table_name='alert_records')
    op.drop_table('alert_records')
    op.drop_index(op.f('ix_alert_rules_tenant_id'), table_name='alert_rules')
    op.drop_table('alert_rules')
    op.drop_index(op.f('ix_alert_channels_tenant_id'), table_name='alert_channels')
    op.drop_table('alert_channels')
    op.drop_index(op.f('ix_playbook_executions_tenant_id'), table_name='playbook_executions')
    op.drop_table('playbook_executions')
    op.drop_index(op.f('ix_ansible_playbooks_tenant_id'), table_name='ansible_playbooks')
    op.drop_table('ansible_playbooks')
    op.drop_table('host_metrics')
    op.drop_table('host_info')
    op.drop_index(op.f('ix_ssh_hosts_tenant_id'), table_name='ssh_hosts')
    op.drop_table('ssh_hosts')
    op.drop_index(op.f('ix_operation_logs_tenant_id'), table_name='operation_logs')
    op.drop_table('operation_logs')
    op.drop_index(op.f('ix_menus_tenant_id'), table_name='menus')
    op.drop_table('menus')
    op.drop_table('user_roles')
    op.drop_index(op.f('ix_roles_tenant_id'), table_name='roles')
    op.drop_table('roles')
    op.drop_index(op.f('ix_users_tenant_id'), table_name='users')
    op.drop_table('users')
    op.drop_table('tenants')
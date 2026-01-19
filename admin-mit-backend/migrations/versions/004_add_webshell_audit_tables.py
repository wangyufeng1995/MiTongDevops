"""Add WebShell audit logs and command filter rules tables

Revision ID: 004
Revises: 003
Create Date: 2026-01-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None

# 默认黑名单命令
DEFAULT_BLACKLIST = [
    'rm', 'rmdir', 'rm -rf', 'rm -r',
    'reboot', 'shutdown', 'poweroff', 'halt', 'init',
    'dd', 'mkfs', 'mkfs.*', 'fdisk', 'parted',
    'kill', 'killall', 'pkill',
    'chmod 777', 'chown',
    'wget', 'curl -o', 'curl -O',
    '> /dev/sda', '> /dev/null',
    'format', 'del /f', 'deltree',
    'iptables -F', 'iptables -X',
    'passwd', 'useradd', 'userdel', 'usermod',
    'visudo', 'sudoers',
]


def upgrade():
    # Create webshell_audit_logs table
    op.create_table('webshell_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('host_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.String(length=100), nullable=True),
        sa.Column('command', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('output_summary', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('block_reason', sa.String(length=255), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('execution_time', sa.Float(), nullable=True),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['host_id'], ['ssh_hosts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    # Create indexes for webshell_audit_logs
    op.create_index('idx_audit_host_date', 'webshell_audit_logs', ['host_id', 'executed_at'], unique=False)
    op.create_index('idx_audit_user_date', 'webshell_audit_logs', ['user_id', 'executed_at'], unique=False)
    op.create_index('idx_audit_status', 'webshell_audit_logs', ['status'], unique=False)
    op.create_index('idx_audit_tenant_date', 'webshell_audit_logs', ['tenant_id', 'executed_at'], unique=False)
    op.create_index(op.f('ix_webshell_audit_logs_tenant_id'), 'webshell_audit_logs', ['tenant_id'], unique=False)
    
    # Create command_filter_rules table
    op.create_table('command_filter_rules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('host_id', sa.Integer(), nullable=True),
        sa.Column('mode', sa.String(length=20), nullable=False, server_default='blacklist'),
        sa.Column('whitelist', sa.JSON(), nullable=True),
        sa.Column('blacklist', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.ForeignKeyConstraint(['host_id'], ['ssh_hosts.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'host_id', name='uq_filter_rule_tenant_host')
    )
    op.create_index(op.f('ix_command_filter_rules_tenant_id'), 'command_filter_rules', ['tenant_id'], unique=False)


def downgrade():
    # Drop command_filter_rules table
    op.drop_index(op.f('ix_command_filter_rules_tenant_id'), table_name='command_filter_rules')
    op.drop_table('command_filter_rules')
    
    # Drop webshell_audit_logs table
    op.drop_index(op.f('ix_webshell_audit_logs_tenant_id'), table_name='webshell_audit_logs')
    op.drop_index('idx_audit_tenant_date', table_name='webshell_audit_logs')
    op.drop_index('idx_audit_status', table_name='webshell_audit_logs')
    op.drop_index('idx_audit_user_date', table_name='webshell_audit_logs')
    op.drop_index('idx_audit_host_date', table_name='webshell_audit_logs')
    op.drop_table('webshell_audit_logs')

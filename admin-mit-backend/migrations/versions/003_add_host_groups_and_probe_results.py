"""Add host groups and probe results tables

Revision ID: 003
Revises: 002
Create Date: 2026-01-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    # Create host_groups table
    op.create_table('host_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'name', name='uq_host_group_tenant_name')
    )
    op.create_index(op.f('ix_host_groups_tenant_id'), 'host_groups', ['tenant_id'], unique=False)
    
    # Add group_id and probe fields to ssh_hosts table
    op.add_column('ssh_hosts', sa.Column('group_id', sa.Integer(), nullable=True))
    op.add_column('ssh_hosts', sa.Column('last_probe_status', sa.String(length=20), nullable=True))
    op.add_column('ssh_hosts', sa.Column('last_probe_at', sa.DateTime(), nullable=True))
    op.add_column('ssh_hosts', sa.Column('last_probe_message', sa.Text(), nullable=True))
    op.create_foreign_key('fk_ssh_hosts_group_id', 'ssh_hosts', 'host_groups', ['group_id'], ['id'])
    
    # Create host_probe_results table
    op.create_table('host_probe_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('host_id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.String(length=100), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('ansible_output', sa.Text(), nullable=True),
        sa.Column('response_time', sa.Float(), nullable=True),
        sa.Column('probed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['host_id'], ['ssh_hosts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_host_probe_results_host_id'), 'host_probe_results', ['host_id'], unique=False)


def downgrade():
    # Drop host_probe_results table
    op.drop_index(op.f('ix_host_probe_results_host_id'), table_name='host_probe_results')
    op.drop_table('host_probe_results')
    
    # Remove columns from ssh_hosts
    op.drop_constraint('fk_ssh_hosts_group_id', 'ssh_hosts', type_='foreignkey')
    op.drop_column('ssh_hosts', 'last_probe_message')
    op.drop_column('ssh_hosts', 'last_probe_at')
    op.drop_column('ssh_hosts', 'last_probe_status')
    op.drop_column('ssh_hosts', 'group_id')
    
    # Drop host_groups table
    op.drop_index(op.f('ix_host_groups_tenant_id'), table_name='host_groups')
    op.drop_table('host_groups')

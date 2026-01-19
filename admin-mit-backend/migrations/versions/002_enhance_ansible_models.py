"""enhance ansible models

Revision ID: 002
Revises: 001
Create Date: 2024-01-05 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to ansible_playbooks table
    op.add_column('ansible_playbooks', sa.Column('tags', sa.JSON(), nullable=True))
    op.add_column('ansible_playbooks', sa.Column('is_active', sa.Boolean(), nullable=True, default=True))
    op.add_column('ansible_playbooks', sa.Column('category', sa.String(length=50), nullable=True))
    
    # Add new columns to playbook_executions table
    op.add_column('playbook_executions', sa.Column('execution_id', sa.String(length=100), nullable=True))
    op.add_column('playbook_executions', sa.Column('progress', sa.Integer(), nullable=True, default=0))
    op.add_column('playbook_executions', sa.Column('total_tasks', sa.Integer(), nullable=True, default=0))
    op.add_column('playbook_executions', sa.Column('completed_tasks', sa.Integer(), nullable=True, default=0))
    op.add_column('playbook_executions', sa.Column('failed_tasks', sa.Integer(), nullable=True, default=0))
    op.add_column('playbook_executions', sa.Column('skipped_tasks', sa.Integer(), nullable=True, default=0))
    
    # Update existing records to set default values
    op.execute("UPDATE ansible_playbooks SET is_active = true WHERE is_active IS NULL")
    op.execute("UPDATE playbook_executions SET progress = 0 WHERE progress IS NULL")
    op.execute("UPDATE playbook_executions SET total_tasks = 0 WHERE total_tasks IS NULL")
    op.execute("UPDATE playbook_executions SET completed_tasks = 0 WHERE completed_tasks IS NULL")
    op.execute("UPDATE playbook_executions SET failed_tasks = 0 WHERE failed_tasks IS NULL")
    op.execute("UPDATE playbook_executions SET skipped_tasks = 0 WHERE skipped_tasks IS NULL")


def downgrade():
    # Remove columns from playbook_executions table
    op.drop_column('playbook_executions', 'skipped_tasks')
    op.drop_column('playbook_executions', 'failed_tasks')
    op.drop_column('playbook_executions', 'completed_tasks')
    op.drop_column('playbook_executions', 'total_tasks')
    op.drop_column('playbook_executions', 'progress')
    op.drop_column('playbook_executions', 'execution_id')
    
    # Remove columns from ansible_playbooks table
    op.drop_column('ansible_playbooks', 'category')
    op.drop_column('ansible_playbooks', 'is_active')
    op.drop_column('ansible_playbooks', 'tags')
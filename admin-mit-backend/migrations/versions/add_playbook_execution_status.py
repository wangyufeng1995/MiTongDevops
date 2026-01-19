"""add playbook execution status fields

Revision ID: add_playbook_exec_status
Revises: 
Create Date: 2026-01-15

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_playbook_exec_status'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    """添加 Playbook 执行状态相关字段"""
    # 添加 last_execution_status 字段
    op.add_column('ansible_playbooks', 
        sa.Column('last_execution_status', sa.String(20), nullable=True)
    )
    
    # 添加 last_executed_at 字段
    op.add_column('ansible_playbooks', 
        sa.Column('last_executed_at', sa.DateTime, nullable=True)
    )
    
    # 添加 execution_count 字段
    op.add_column('ansible_playbooks', 
        sa.Column('execution_count', sa.Integer, default=0, nullable=True)
    )


def downgrade():
    """回滚：删除添加的字段"""
    op.drop_column('ansible_playbooks', 'last_execution_status')
    op.drop_column('ansible_playbooks', 'last_executed_at')
    op.drop_column('ansible_playbooks', 'execution_count')

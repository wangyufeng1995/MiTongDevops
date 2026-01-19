"""merge heads

Revision ID: e513a83e6461
Revises: 010_add_grafana_auth, add_playbook_exec_status
Create Date: 2026-01-16 14:16:27.178150

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e513a83e6461'
down_revision = ('010_add_grafana_auth', 'add_playbook_exec_status')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
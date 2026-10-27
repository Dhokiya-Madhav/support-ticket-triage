"""more ticket categories

Revision ID: f499998b6bfe
Revises: 72d58768a4d9
Create Date: 2026-10-26 22:07:59.006525
"""
from alembic import op
import sqlalchemy as sa


revision = 'f499998b6bfe'
down_revision = '72d58768a4d9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres enums can only grow: the new values are added to the shared "category" type.
    for value in ("refund", "account", "integration", "feature_request", "cancellation"):
        op.execute(f"ALTER TYPE category ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Enum values cannot be removed in place; the extra values are simply left unused.
    pass

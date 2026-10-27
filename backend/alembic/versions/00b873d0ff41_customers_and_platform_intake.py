"""customers and platform intake

Revision ID: 00b873d0ff41
Revises: 3244c3e0ce40
Create Date: 2026-10-25 15:33:29.076150
"""
from alembic import op
import sqlalchemy as sa


revision = '00b873d0ff41'
down_revision = '3244c3e0ce40'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE role ADD VALUE IF NOT EXISTS 'customer'")
    op.drop_index(op.f('ix_messages_in_reply_to'), table_name='messages')
    op.drop_index(op.f('ix_messages_provider_message_id'), table_name='messages')
    op.drop_column('messages', 'in_reply_to')
    op.drop_column('messages', 'provider_message_id')
    op.drop_column('messages', 'body_html')
    op.add_column('tickets', sa.Column('customer_id', sa.Integer(), nullable=False))
    op.alter_column('tickets', 'subject',
               existing_type=sa.VARCHAR(length=998),
               type_=sa.String(length=200),
               existing_nullable=False)
    op.drop_index(op.f('ix_tickets_customer_email'), table_name='tickets')
    op.create_index(op.f('ix_tickets_customer_id'), 'tickets', ['customer_id'], unique=False)
    op.create_foreign_key('fk_tickets_customer_id_users', 'tickets', 'users', ['customer_id'], ['id'])
    op.drop_column('tickets', 'customer_email')


def downgrade() -> None:
    op.add_column('tickets', sa.Column('customer_email', sa.VARCHAR(length=320), autoincrement=False, nullable=False))
    op.drop_constraint('fk_tickets_customer_id_users', 'tickets', type_='foreignkey')
    op.drop_index(op.f('ix_tickets_customer_id'), table_name='tickets')
    op.create_index(op.f('ix_tickets_customer_email'), 'tickets', ['customer_email'], unique=False)
    op.alter_column('tickets', 'subject',
               existing_type=sa.String(length=200),
               type_=sa.VARCHAR(length=998),
               existing_nullable=False)
    op.drop_column('tickets', 'customer_id')
    op.add_column('messages', sa.Column('body_html', sa.TEXT(), autoincrement=False, nullable=True))
    op.add_column('messages', sa.Column('provider_message_id', sa.VARCHAR(length=998), autoincrement=False, nullable=True))
    op.add_column('messages', sa.Column('in_reply_to', sa.VARCHAR(length=998), autoincrement=False, nullable=True))
    op.create_index(op.f('ix_messages_provider_message_id'), 'messages', ['provider_message_id'], unique=True)
    op.create_index(op.f('ix_messages_in_reply_to'), 'messages', ['in_reply_to'], unique=False)
    # NOTE: the 'customer' value added to the role enum is not removed on downgrade.

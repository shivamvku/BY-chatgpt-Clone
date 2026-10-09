"""Initial application schema; immutable snapshot, UTC epoch timestamps."""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("actor_id", sa.String(length=36), nullable=False, primary_key=False),
        sa.Column("target_id", sa.String(length=36), nullable=False, primary_key=False),
        sa.Column("action", sa.String(length=60), nullable=False, primary_key=False),
        sa.Column("created_at", sa.Integer(), nullable=False, primary_key=False),
    )
    op.create_index("ix_audit_events_actor_id", "audit_events", ["actor_id"], unique=False)
    op.create_table(
        "rate_buckets",
        sa.Column("key", sa.String(length=64), nullable=False, primary_key=True),
        sa.Column("count", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("expires_at", sa.Integer(), nullable=False, primary_key=False),
    )
    op.create_index("ix_rate_buckets_expires_at", "rate_buckets", ["expires_at"], unique=False)
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column("email", sa.String(length=254), nullable=False, primary_key=False),
        sa.Column("name", sa.String(length=80), nullable=False, primary_key=False),
        sa.Column("password_hash", sa.Text(), nullable=False, primary_key=False),
        sa.Column("role", sa.String(length=16), nullable=False, primary_key=False),
        sa.Column("active", sa.Boolean(), nullable=False, primary_key=False),
        sa.Column("appearance", sa.String(length=16), nullable=False, primary_key=False),
        sa.Column("contrast", sa.String(length=16), nullable=False, primary_key=False),
        sa.Column("created_at", sa.Integer(), nullable=False, primary_key=False),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "attachments",
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("name", sa.String(length=120), nullable=False, primary_key=False),
        sa.Column("media_type", sa.String(length=32), nullable=False, primary_key=False),
        sa.Column("data", sa.LargeBinary(), nullable=False, primary_key=False),
        sa.Column("created_at", sa.Integer(), nullable=False, primary_key=False),
    )
    op.create_index("ix_attachments_user_id", "attachments", ["user_id"], unique=False)
    op.create_table(
        "conversations",
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("title", sa.String(length=120), nullable=False, primary_key=False),
        sa.Column("archived", sa.Boolean(), nullable=False, primary_key=False),
        sa.Column("created_at", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("updated_at", sa.Integer(), nullable=False, primary_key=False),
    )
    op.create_index(
        "ix_conversation_owner_order",
        "conversations",
        ["user_id", "updated_at", "id"],
        unique=False,
    )
    op.create_table(
        "sessions",
        sa.Column("token_hash", sa.String(length=64), nullable=False, primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("csrf_hash", sa.String(length=64), nullable=False, primary_key=False),
        sa.Column("created_at", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("expires_at", sa.Integer(), nullable=False, primary_key=False),
    )
    op.create_index("ix_sessions_expires_at", "sessions", ["expires_at"], unique=False)
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"], unique=False)
    op.create_table(
        "usage",
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=True,
        ),
        sa.Column("day", sa.String(length=10), nullable=False, primary_key=True),
        sa.Column("requests", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("reserved_tokens", sa.Integer(), nullable=False, primary_key=False),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.String(length=36), nullable=False, primary_key=True),
        sa.Column(
            "conversation_id",
            sa.String(length=36),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
            primary_key=False,
        ),
        sa.Column("parent_id", sa.String(length=36), nullable=True, primary_key=False),
        sa.Column("role", sa.String(length=16), nullable=False, primary_key=False),
        sa.Column("content", sa.Text(), nullable=False, primary_key=False),
        sa.Column("status", sa.String(length=16), nullable=False, primary_key=False),
        sa.Column("model", sa.String(length=120), nullable=False, primary_key=False),
        sa.Column("request_id", sa.String(length=36), nullable=True, primary_key=False),
        sa.Column("created_at", sa.Integer(), nullable=False, primary_key=False),
        sa.Column("updated_at", sa.Integer(), nullable=False, primary_key=False),
        sa.UniqueConstraint("conversation_id", "request_id"),
    )
    op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"], unique=False)


def downgrade():
    raise RuntimeError("Destructive downgrade disabled; restore a reviewed backup")

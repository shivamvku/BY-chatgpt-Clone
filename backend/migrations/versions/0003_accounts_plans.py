"""Verified accounts, single sessions, subscription policy and durable usage records."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column("verified_user", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch.add_column(sa.Column("email_verified_at", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("bio", sa.String(500), nullable=False, server_default=""))
        batch.add_column(sa.Column("timezone", sa.String(80), nullable=False, server_default="UTC"))
    with op.batch_alter_table("sessions") as batch:
        batch.add_column(
            sa.Column("last_active_at", sa.Integer(), nullable=False, server_default="0")
        )
        batch.add_column(
            sa.Column("source", sa.String(120), nullable=False, server_default="Unknown browser")
        )
    # Existing sessions are revoked to enforce the new policy consistently.
    op.execute(sa.text("DELETE FROM sessions"))
    op.create_index("ix_single_user_session", "sessions", ["user_id"], unique=True)
    op.create_table(
        "account_tokens",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("purpose", sa.String(20), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
    )
    op.create_index("ix_account_tokens_user_id", "account_tokens", ["user_id"])
    op.create_index("ix_account_tokens_expires_at", "account_tokens", ["expires_at"])
    plans = op.create_table(
        "plans",
        sa.Column("id", sa.String(16), primary_key=True),
        sa.Column("name", sa.String(40), nullable=False),
        sa.Column("seats", sa.Integer(), nullable=False),
        sa.Column("daily_requests", sa.Integer(), nullable=False),
        sa.Column("daily_tokens", sa.Integer(), nullable=False),
        sa.Column("retention_days", sa.Integer()),
        sa.Column("storage_bytes", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
    )
    op.bulk_insert(
        plans,
        [
            dict(
                id="basic",
                name="Basic",
                seats=1,
                daily_requests=10,
                daily_tokens=10000,
                retention_days=7,
                storage_bytes=20971520,
                version=1,
            ),
            dict(
                id="pro",
                name="Pro",
                seats=2,
                daily_requests=30,
                daily_tokens=40000,
                retention_days=183,
                storage_bytes=104857600,
                version=1,
            ),
            dict(
                id="pro_max",
                name="Pro Max",
                seats=5,
                daily_requests=60,
                daily_tokens=80000,
                retention_days=None,
                storage_bytes=524288000,
                version=1,
            ),
        ],
    )
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("owner_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan_id", sa.String(16), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("expires_at", sa.Integer()),
        sa.Column("created_at", sa.Integer(), nullable=False),
    )
    op.create_index("ix_subscriptions_owner_id", "subscriptions", ["owner_id"])
    op.create_table(
        "memberships",
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column(
            "subscription_id", sa.String(36), sa.ForeignKey("subscriptions.id"), nullable=False
        ),
    )
    op.create_index("ix_memberships_subscription_id", "memberships", ["subscription_id"])
    op.create_table(
        "invitations",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column(
            "subscription_id", sa.String(36), sa.ForeignKey("subscriptions.id"), nullable=False
        ),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
    )
    op.create_index("ix_invitations_subscription_id", "invitations", ["subscription_id"])
    op.create_table(
        "usage_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "subscription_id", sa.String(36), sa.ForeignKey("subscriptions.id"), nullable=False
        ),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("reserved_tokens", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("created_at", sa.Integer(), nullable=False),
    )
    for column in ("user_id", "subscription_id", "created_at"):
        op.create_index(f"ix_usage_events_{column}", "usage_events", [column])
    # Backfill existing accounts without claiming that their emails were verified.
    op.execute(
        sa.text(
            "INSERT INTO subscriptions (id,owner_id,plan_id,status,created_at) "
            "SELECT id,id,'basic','active',created_at FROM users"
        )
    )
    op.execute(sa.text("INSERT INTO memberships (user_id,subscription_id) SELECT id,id FROM users"))


def downgrade():
    raise RuntimeError("Destructive downgrade disabled; restore a reviewed backup")

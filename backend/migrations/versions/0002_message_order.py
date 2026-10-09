"""Stable insertion order for message trees, including branches created in the same second."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    # Accommodate the unreleased local schema snapshot used during development.
    if "ordinal" not in {
        column["name"] for column in sa.inspect(connection).get_columns("messages")
    }:
        op.add_column("messages", sa.Column("ordinal", sa.Integer(), nullable=True))
    rows = connection.execute(
        sa.text("SELECT id, conversation_id FROM messages ORDER BY conversation_id, created_at, id")
    ).all()
    counts = {}
    for identifier, conversation in rows:
        counts[conversation] = counts.get(conversation, 0) + 1
        connection.execute(
            sa.text("UPDATE messages SET ordinal=:ordinal WHERE id=:id"),
            {"ordinal": counts[conversation], "id": identifier},
        )
    with op.batch_alter_table("messages") as batch:
        batch.alter_column("ordinal", existing_type=sa.Integer(), nullable=False)
        batch.create_index("ix_message_branch_order", ["conversation_id", "ordinal"], unique=True)


def downgrade():
    raise RuntimeError("Destructive downgrade disabled; restore a reviewed backup")

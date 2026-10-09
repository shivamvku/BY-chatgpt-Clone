"""Migration release history and limited database-management views."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "schema_migrations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("from_revision", sa.String(32), nullable=True),
        sa.Column("to_revision", sa.String(32), nullable=False),
        sa.Column("commit_sha", sa.String(40), nullable=False),
        sa.Column("image", sa.String(255), nullable=False),
        sa.Column("applied_at", sa.Integer(), nullable=False),
    )
    op.execute("CREATE VIEW schema_status AS SELECT version_num AS revision FROM alembic_version")
    op.execute(
        "CREATE VIEW operator_users AS SELECT id,email,name,role,active,verified_user,created_at "
        "FROM users"
    )
    op.execute(
        "CREATE VIEW operator_files AS SELECT id,user_id,name,media_type,created_at,"
        "length(data) AS size FROM attachments"
    )


def downgrade():
    raise RuntimeError("Destructive downgrade disabled; restore a reviewed backup")

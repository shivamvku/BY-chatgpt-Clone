"""Fixed operator commands; job configuration comes from Terraform, never CLI overrides."""

import json
import os
import sys

from sqlalchemy import text

from app.db.session import get_engine
from app.manage import main as promote


def main():
    operation = os.environ.get("OPERATION", "migration-status")
    if operation == "promote-admin":
        email = os.environ.get("OPERATOR_EMAIL", "").strip()
        if not email or len(email) > 254 or "@" not in email:
            raise SystemExit("A valid operator email is required")
        sys.argv = ["operator", "promote-admin", "--email", email]
        promote()
    elif operation == "migration-status":
        with get_engine().connect() as connection:
            revision = connection.execute(text("SELECT revision FROM schema_status")).scalar_one()
            history = (
                connection.execute(
                    text(
                        "SELECT from_revision,to_revision,commit_sha,image,applied_at "
                        "FROM schema_migrations ORDER BY applied_at DESC LIMIT 10"
                    )
                )
                .mappings()
                .all()
            )
        print(json.dumps({"revision": revision, "history": [dict(row) for row in history]}))
    else:
        raise SystemExit("Unsupported operator command")


if __name__ == "__main__":
    main()

import os

from alembic import command
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy.orm import Session

from app.db.provision import provision_runtime
from app.db.session import get_engine
from app.models.entities import SchemaMigration


def main():
    config = Config("alembic.ini")
    with get_engine().connect() as connection:
        before = MigrationContext.configure(connection).get_current_revision()
    command.upgrade(config, "head")
    command.check(config)
    with get_engine().connect() as connection:
        after = MigrationContext.configure(connection).get_current_revision()
    if before != after:
        with Session(get_engine()) as db:
            db.add(
                SchemaMigration(
                    from_revision=before,
                    to_revision=after,
                    commit_sha=os.environ.get("RELEASE_COMMIT", ""),
                    image=os.environ.get("RELEASE_IMAGE", ""),
                )
            )
            db.commit()
    provision_runtime()
    print(f"Schema revision: {before or 'empty'} -> {after}")


if __name__ == "__main__":
    main()

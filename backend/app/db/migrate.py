from alembic import command
from alembic.config import Config

from app.db.provision import provision_runtime


def main():
    command.upgrade(Config("alembic.ini"), "head")
    provision_runtime()


if __name__ == "__main__":
    main()

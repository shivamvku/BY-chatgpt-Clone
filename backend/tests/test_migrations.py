from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.core.config import get_settings
from app.db.session import get_engine


def test_fresh_migration_chain(monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'migrations.db'}")
    get_settings.cache_clear()
    get_engine.cache_clear()
    config = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    config.set_main_option("script_location", str(Path(__file__).parents[1] / "migrations"))
    command.upgrade(config, "head")
    command.check(config)
    schema = inspect(get_engine())
    assert {"users", "sessions", "messages", "conversations", "usage"} <= set(
        schema.get_table_names()
    )
    assert "ordinal" in {column["name"] for column in schema.get_columns("messages")}
    command.upgrade(config, "head")
    get_engine().dispose()
    get_engine.cache_clear()
    get_settings.cache_clear()

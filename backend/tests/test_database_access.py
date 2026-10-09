"""Exercise real PostgreSQL grants only in the explicitly isolated CI/test database."""

import os
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from app.core.config import get_settings
from app.db.migrate import main as migrate
from app.db.session import Base, get_engine


def test_observer_permissions_and_migration_history(monkeypatch):
    url = os.environ.get("TEST_DATABASE_URL", "")
    if not url.startswith("postgresql"):
        pytest.skip("Requires PostgreSQL grants")
    if not url.endswith("/younderchat_test"):
        raise RuntimeError("Permission tests require the isolated younderchat_test database")
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    get_engine.cache_clear()
    engine = get_engine()
    runtime_url = engine.url.set(username="chat_runtime", password="local-runtime-only-password")
    observer_url = engine.url.set(username="chat_observer", password="test-observer-only-password")
    monkeypatch.setenv("RUNTIME_DATABASE_URL", runtime_url.render_as_string(hide_password=False))
    monkeypatch.setenv("OBSERVER_DATABASE_URL", observer_url.render_as_string(hide_password=False))
    monkeypatch.setenv("RELEASE_COMMIT", "a" * 40)
    monkeypatch.setenv("RELEASE_IMAGE", "permission-test-image")
    monkeypatch.chdir(Path(__file__).parents[1])
    observer, runtime = create_engine(observer_url), create_engine(runtime_url)
    try:
        migrate()
        migrate()  # Idempotent: never duplicate a schema-transition record.
        with observer.connect() as connection:
            assert (
                connection.execute(text("SELECT revision FROM schema_status")).scalar_one()
                == "0004"
            )
            assert (
                connection.execute(text("SELECT count(*) FROM schema_migrations")).scalar_one() == 1
            )
            assert (
                "password_hash"
                not in connection.execute(text("SELECT * FROM operator_users")).keys()
            )
        for sql in (
            "SELECT * FROM users",
            "SELECT * FROM sessions",
            "SELECT * FROM account_tokens",
            "UPDATE plans SET daily_tokens=0",
            "CREATE TABLE forbidden(id int)",
        ):
            with observer.connect() as connection, pytest.raises(DBAPIError):
                connection.execute(text(sql))
        with runtime.connect() as connection, pytest.raises(DBAPIError):
            connection.execute(text("DELETE FROM audit_events"))
        with runtime.connect() as connection, pytest.raises(DBAPIError):
            connection.execute(text("SELECT * FROM alembic_version"))
    finally:
        observer.dispose()
        runtime.dispose()
        with engine.begin() as connection:
            for view in ("operator_users", "operator_files", "schema_status"):
                connection.execute(text(f"DROP VIEW IF EXISTS {view}"))
        Base.metadata.drop_all(engine)
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
        engine.dispose()
        get_engine.cache_clear()
        get_settings.cache_clear()

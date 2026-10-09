"""Run inside the migration job with administrator credentials, never in the web runtime."""

import os
from urllib.parse import unquote, urlparse

from sqlalchemy import text

from app.db.session import get_engine


def provision_runtime():
    runtime_url = os.environ.get("RUNTIME_DATABASE_URL")
    if not runtime_url:
        if os.environ.get("APP_ENV") == "production":
            raise RuntimeError("RUNTIME_DATABASE_URL is required for production migrations")
        return
    parsed = urlparse(runtime_url.replace("postgresql+psycopg", "postgresql"))
    if parsed.username != "chat_runtime" or not parsed.password:
        raise RuntimeError("Runtime URL must use the restricted chat_runtime role")
    with get_engine().begin() as connection:
        if unquote(parsed.path.lstrip("/")) != get_engine().url.database:
            raise RuntimeError("Migration and runtime URLs must refer to the same database")
        raw = connection.connection.driver_connection
        from psycopg import sql

        with raw.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = 'chat_runtime'")
            if not cursor.fetchone():
                cursor.execute("CREATE ROLE chat_runtime LOGIN")
            cursor.execute(
                sql.SQL(
                    "ALTER ROLE chat_runtime WITH LOGIN NOSUPERUSER NOCREATEDB "
                    "NOCREATEROLE NOREPLICATION PASSWORD {}"
                ).format(sql.Literal(unquote(parsed.password)))
            )
            cursor.execute(
                sql.SQL("GRANT CONNECT ON DATABASE {} TO chat_runtime").format(
                    sql.Identifier(get_engine().url.database)
                )
            )
        connection.execute(text("REVOKE CREATE ON SCHEMA public FROM PUBLIC"))
        connection.execute(text("GRANT USAGE ON SCHEMA public TO chat_runtime"))
        for table in (
            "users",
            "sessions",
            "rate_buckets",
            "conversations",
            "messages",
            "usage",
            "attachments",
            "audit_events",
            "account_tokens",
            "plans",
            "subscriptions",
            "memberships",
            "usage_events",
            "invitations",
        ):
            connection.execute(
                text(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO chat_runtime")
            )
        connection.execute(text("REVOKE UPDATE, DELETE ON audit_events FROM chat_runtime"))
        connection.execute(text("GRANT SELECT ON schema_status, schema_migrations TO chat_runtime"))
        observer_url = os.environ.get("OBSERVER_DATABASE_URL")
        if observer_url:
            provision_observer(connection, observer_url)
        elif connection.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname='chat_observer'")
        ).scalar():
            connection.execute(text("ALTER ROLE chat_observer NOLOGIN"))


def provision_observer(connection, observer_url: str):
    """Dedicated human read-only login; never grant access to password/session/token tables."""
    from psycopg import sql

    parsed = urlparse(observer_url.replace("postgresql+psycopg", "postgresql"))
    if (
        parsed.username != "chat_observer"
        or not parsed.password
        or unquote(parsed.path.lstrip("/")) != get_engine().url.database
    ):
        raise RuntimeError("Observer URL must use chat_observer on the migration database")
    with connection.connection.driver_connection.cursor() as cursor:
        cursor.execute("SELECT 1 FROM pg_roles WHERE rolname = 'chat_observer'")
        if not cursor.fetchone():
            cursor.execute("CREATE ROLE chat_observer LOGIN")
        cursor.execute(
            sql.SQL(
                "ALTER ROLE chat_observer WITH LOGIN NOSUPERUSER NOCREATEDB "
                "NOCREATEROLE NOREPLICATION PASSWORD {}"
            ).format(sql.Literal(unquote(parsed.password)))
        )
        cursor.execute(
            sql.SQL("GRANT CONNECT ON DATABASE {} TO chat_observer").format(
                sql.Identifier(get_engine().url.database)
            )
        )
    connection.execute(text("GRANT USAGE ON SCHEMA public TO chat_observer"))
    tables = (
        "operator_users",
        "operator_files",
        "schema_status",
        "schema_migrations",
        "conversations",
        "messages",
        "usage",
        "usage_events",
        "audit_events",
        "plans",
        "subscriptions",
        "memberships",
    )
    for table in tables:
        connection.execute(text(f"GRANT SELECT ON {table} TO chat_observer"))


if __name__ == "__main__":
    provision_runtime()

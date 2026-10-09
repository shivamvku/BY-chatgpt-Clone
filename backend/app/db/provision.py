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


if __name__ == "__main__":
    provision_runtime()

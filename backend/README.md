# Backend boundaries

`api` owns routing, `schemas` request/response contracts, `services` use cases, `models` persistence entities, `db` connections/metadata, and `core` configuration. Keep SQL and provider SDK calls out of routes as features are added.

Run `python -m app.db.migrate` from this directory with `DATABASE_URL` configured. Versioned schema snapshots create application tables and stable message ordering. Production migrations require `RUNTIME_DATABASE_URL`; the migration job provisions the restricted role and explicit DML grants after applying schema changes. The web app uses that runtime connection, never the administrator URL. Destructive downgrades are disabled.

Health endpoints expose no secrets. Development OpenAPI is `/api/docs`. Authenticated mutations require the allowed `Origin` and `X-CSRF-Token` returned by `/api/auth/session`; the CSRF token is bound to the server-side session. Session tokens are opaque and hashed at rest. Conversations/messages, streaming, images and admin access enforce identity and ownership in the service layer.

Streaming uses authenticated POST `/api/generations/{id}/stream` after message creation. SSE events are `start`, `delta`, `done` and `error`. Persisted statuses distinguish pending, streaming, complete, failed, stopping and stopped. Stop/disconnect cancel the upstream; silent upstreams are polled for cancellation. Generation deadlines and abandoned leases are bounded. Clients reuse request IDs when retrying uncertain submissions.

Run `pytest` for isolated SQLite tests. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database named `younderchat_test` for integration tests; tests create/drop only that database's application tables. Browser fixtures live under `tests/`, never the production service. See the implementation plan for validation evidence and limitations.

## Track schema changes

From `backend/`, using the migration/owner connection:

```powershell
alembic current
alembic heads
alembic history --verbose
alembic check
```

Each file in `migrations/versions/` has an immutable `revision` and `down_revision`. Git records the schema edit and review; `alembic_version` records the current database revision. Never edit a revision already deployed: create a new revision after changing models:

```powershell
alembic revision --autogenerate -m "describe the schema change"
```

Review generated SQL operations, indexes, constraints, data backfills and old-version compatibility. Autogeneration does not manage the SQL views or role grants; write those explicitly. Commit the new migration with its model changes. CI upgrades a fresh schema and checks for missing migrations; release upgrades the private database before deploying the app. Use `python -m app.db.migrate` rather than a bare upgrade for deployed releases so grants and release history are recorded.

In DBeaver, the read-only operator can inspect:

```sql
SELECT revision FROM schema_status;
SELECT from_revision, to_revision, commit_sha, image,
       to_timestamp(applied_at) AS applied_at
FROM schema_migrations
ORDER BY applied_at DESC;
```

The history table records actual schema transitions, including the commit and immutable image supplied by the release pipeline. Re-running the same migration does not add a duplicate transition. It does not reconstruct releases made before this tracking table existed. Alembic history provides the full revision chain.

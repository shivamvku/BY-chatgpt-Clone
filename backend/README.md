# Backend boundaries

`api` owns routing, `schemas` request/response contracts, `services` use cases, `models` persistence entities, `db` connections/metadata, and `core` configuration. Keep SQL and provider SDK calls out of routes as features are added.

Run `python -m app.db.migrate` from this directory with `DATABASE_URL` configured. Versioned schema snapshots create application tables and stable message ordering. Production migrations require `RUNTIME_DATABASE_URL`; the migration job provisions the restricted role and explicit DML grants after applying schema changes. The web app uses that runtime connection, never the administrator URL. Destructive downgrades are disabled.

Health endpoints expose no secrets. Development OpenAPI is `/api/docs`. Authenticated mutations require the allowed `Origin` and `X-CSRF-Token` returned by `/api/auth/session`; the CSRF token is bound to the server-side session. Session tokens are opaque and hashed at rest. Conversations/messages, streaming, images and admin access enforce identity and ownership in the service layer.

Streaming uses authenticated POST `/api/generations/{id}/stream` after message creation. SSE events are `start`, `delta`, `done` and `error`. Persisted statuses distinguish pending, streaming, complete, failed, stopping and stopped. Stop/disconnect cancel the upstream; silent upstreams are polled for cancellation. Generation deadlines and abandoned leases are bounded. Clients reuse request IDs when retrying uncertain submissions.

Run `pytest` for isolated SQLite tests. Set `TEST_DATABASE_URL` to a dedicated PostgreSQL database named `younderchat_test` for integration tests; tests create/drop only that database's application tables. Browser fixtures live under `tests/`, never the production service. See the implementation plan for validation evidence and limitations.

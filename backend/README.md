# Backend boundaries

`api` owns routing, `schemas` request/response contracts, `services` use cases, `models` persistence entities, `db` connections/metadata, and `core` configuration. Keep SQL and provider SDK calls out of routes as features are added.

Alembic is initialized with no schema revisions. Import future models into migration metadata before generating the first revision. Run `alembic upgrade head` from this directory with DATABASE_URL configured; deployment runs this inside a Container Apps job.

Health endpoints return no secrets and distinguish process liveness from database readiness. Authentication and AI features are future milestones.

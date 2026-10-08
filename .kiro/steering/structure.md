---
inclusion: always
---
# Repository boundaries

- `frontend/src/app/`: application composition, providers, routing and theme.
- `frontend/src/features/`: domain features with their components, API hooks and types.
- `frontend/src/components/`, `hooks/`, `lib/`: genuinely shared UI and utilities.
- `backend/app/api/`: route composition and HTTP endpoints.
- `backend/app/core/`: settings and cross-cutting configuration.
- `backend/app/db/`, `models/`, `schemas/`, `services/`: sessions, persistence models, API contracts and business logic.
- `backend/migrations/`: versioned Alembic database migrations; `backend/tests/`: meaningful behavior tests.
- `infra/bootstrap/`: state storage and GitHub deployment identity bootstrap.
- `infra/terraform/modules/`: reusable Azure modules; `environments/dev/`: separate foundation, migration and application state roots.
- `infra/docker/`, `scripts/`, `pipelines/`, `config/`, `docs/`: containers, deployment tools, pipeline helpers, nonsecret environment configuration and operational documentation.
- `.github/workflows/`: GitHub workflow entrypoints. Keep substantial deployment logic under `infra/`.
- `.kiro/steering/`: persistent agent guidance; `docs/goal/README.md`: project goal and completion criteria.

Do not put cloud resource creation in frontend or backend code. Do not mix API business logic into routes or scatter feature state across generic utilities. Read the matching API, UI or infrastructure steering file before working in that area, even when automatic file matching has not activated it.

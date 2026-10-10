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
- `infra/bootstrap/`: state storage, app resource group, GitHub plan/deploy identities and federation bootstrap.
- `infra/terraform/environments/dev/`: independently stateful foundation, migration, application and domains roots; retain their lockfiles and state boundaries.
- `infra/terraform/modules/`: reusable Azure resources consumed by environment roots. Trace module references before treating any module as unused.
- `infra/terraform/modules/db-access/`, `infra/config/db-access.json`, and associated scripts/tests: optional database operator gateway; it has potential cost and security impact and is not dead code simply because it is not part of every release.
- `infra/docker/`: local Compose and the multi-stage application image.
- `infra/actions/`, `infra/pipelines/`, `infra/scripts/`: shared GitHub Actions setup, CI/CD/runtime operations and local PowerShell operator workflows.
- `infra/config/`: sanitized examples and non-secret policy/configuration inputs. Never add real credentials or generated state here.
- `infra/docs/`: operational instructions and dated historical evidence; verify whether a document is explicitly historical before relying on it for current status.
- `.github/workflows/`: workflow entrypoints. Keep substantial deployment logic under `infra/`.
- `.kiro/steering/`: persistent coding guidance; `docs/implementation-plan.md`: single source of truth for goals, scope, status and acceptance criteria.

Do not put cloud resource creation in frontend or backend code. Do not mix API business logic into routes or scatter feature state across generic utilities. Read the matching API, UI or infrastructure steering file before working in that area, even when automatic file matching has not activated it.
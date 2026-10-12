# Implementation Status and Boundaries

This document prevents interview material from overstating what is implemented. Recheck source code, tests, workflow YAML and cloud configuration before each release.

## Implemented and documented

- React + TypeScript + Material UI browser application.
- FastAPI REST backend with request schemas and service boundaries.
- Cookie-based session authentication, session-bound CSRF checks, role authorization and resource ownership checks.
- Conversation/message persistence, history pagination and management operations.
- Generation lifecycle with normalized SSE events, stop/cancellation handling, bounded timeouts and partial-result handling.
- Provider abstraction for Gemini and Groq using server-side credentials.
- Usage/plan controls, reservations/records and controlled admin account/plan/session functionality.
- Markdown/code/table/chart rendering and bounded image upload/display.
- SQLAlchemy persistence and Alembic migration workflow.
- Automated backend/frontend/browser tests and Azure/Terraform deployment assets.

## Environment distinctions

| Concern | Local reviewer environment | Deployed design |
| --- | --- | --- |
| Database | Disposable SQLite | Private Azure Database for PostgreSQL |
| Cloud | Not required | Azure resources managed/configured through Terraform and GitHub Actions |
| Provider inference | Requires user-supplied provider key | Requires correctly configured server-side secret, model access and quota |
| Test inference | Deterministic fixtures in browser tests | Not equivalent to live inference |
| Demo credentials | Local-only seeded users | Must not be reused or deployed |

## Explicitly not implemented or not proven by this documentation

- Payment collection, payment provider webhooks and invoice generation.
- A complete end-user image-understanding workflow.
- Working user-facing web search, image generation, document retrieval, voice, scheduled tasks or sandboxed code execution.
- Live provider success merely because a browser test or CI run passed.
- Email delivery merely because password recovery/verification routes exist.
- Exact production Azure resource settings without inspecting the current Terraform and workflow definitions.

## Verification commands

From the repository root, after installing dependencies:

```bash
.venv/bin/ruff check backend
.venv/bin/python -m pytest backend/tests
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix frontend run test
```

On Windows, use the virtual environment executables under `.venv\\Scripts\\`. Browser tests and PostgreSQL integration tests have their own prerequisites; consult the root and backend README files.

## Documentation maintenance

When behavior changes, update:
1. Relevant source comments and tests.
2. [End-to-end workflow](user-workflow.md).
3. [System architecture](architecture.md) and affected [diagrams](diagrams/README.md).
4. The relevant [interview Q&A](prep/README.md).
5. This boundary/status document if implementation scope changed.

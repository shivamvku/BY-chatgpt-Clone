# Implementation Scope and Acceptance Guide

This document records the scope currently described by the repository. Source code, tests and release workflows remain authoritative; use this as a reviewer checklist rather than a claim that every external integration is live.

## Core application scope

- Authentication: registration/login, cookie session lifecycle, security settings and configured recovery/verification flows.
- Authorization: server-side role checks, resource ownership checks and controlled admin operations.
- Chat: conversation and message persistence, generation lifecycle, normalized SSE streaming, stop/cancellation, regenerate/edit-branch and follow-up continuity.
- History: cursor pagination, search, rename, archive/unarchive, delete and Markdown/JSON export.
- Rich output: Markdown, tables, code highlighting, chart rendering and bounded image upload/display.
- Accounts: profile/appearance, plan and usage visibility, admin account/plan controls, invitations, session controls and audit records.
- LLM integration: provider abstraction with Gemini/Groq adapters; live calls require valid server-side credentials, model access and quota.
- Persistence: SQLAlchemy models, Alembic migrations, local SQLite reviewer mode and deployed PostgreSQL.
- Delivery: Docker assets, Terraform-managed Azure resources, GitHub Actions, OIDC-based cloud identity, container registry, Container Apps and post-deployment checks.

## Acceptance matrix

| Area | Minimum acceptance evidence | Important limitation |
| --- | --- | --- |
| Authentication | Tests for valid/invalid login, session and logout/revocation | Do not infer email delivery from route existence |
| Authorization | Tests for role denial and cross-user resource denial | UI hiding alone is insufficient |
| Chat streaming | Tests for start/delta/terminal events, cancellation and failure | Deterministic fixtures do not prove live LLM quality |
| Persistence | Migration upgrade tests and PostgreSQL integration coverage | SQLite alone does not prove production DB behavior |
| Usage controls | Concurrent reservation/settlement tests and boundary cases | Do not claim payment collection |
| Frontend | Unit/lint/build and browser flows | Browser fixtures may mock provider behavior |
| CI/CD | Required checks, migration job and smoke tests succeed | Confirm actual deployed revision separately |
| Cloud security | OIDC trust, scoped roles, secret references and private DB path reviewed | Exact configuration must be read from Terraform/workflows |

## Explicit non-goals / not verified

- Payment collection, payment provider webhooks and invoices.
- Complete image understanding.
- User-facing web search, image generation, document retrieval, voice, scheduled tasks or sandboxed code execution.
- A guaranteed live LLM response without verifying provider configuration and quota.

## Release checklist

- [ ] Required frontend/backend/browser/infrastructure checks pass.
- [ ] New Alembic revision is reviewed and tested against a fresh schema.
- [ ] Runtime database permissions remain restricted.
- [ ] Provider credentials are server-side and not logged or bundled in frontend assets.
- [ ] Deployment workflow shows migrations, rollout and smoke checks succeeded.
- [ ] Critical user flows are manually checked against the deployed revision.
- [ ] Documentation and Mermaid diagrams are updated with behavior changes.

See [architecture](architecture.md), [end-to-end workflow](user-workflow.md), [diagrams](diagrams/README.md), [interview preparation](prep/README.md) and [implementation boundaries](implementation-status.md).

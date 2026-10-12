# YounderChat Interview Preparation

Use these Q&A guides to rehearse the design and defend trade-offs. Answers are intentionally grounded in the documented application; validate implementation details against source/tests before stating them as facts.

## Topic guides

1. [Architecture](architecture.md) — component boundaries, technology choices and trade-offs.
2. [System design](system-design.md) — scale, reliability, capacity, failure handling and design exercises.
3. [API design](api.md) — REST contracts, validation, pagination, errors and idempotency.
4. [UI and frontend](ui.md) — React, state, streaming UX, accessibility and rendering.
5. [CI/CD and DevOps](cicd.md) — GitHub Actions, OIDC, Terraform, migrations and release safety.
6. [Authentication and security](auth.md) — sessions, CSRF, RBAC, ownership, secrets and threat modeling.
7. [LLM integration](llm.md) — provider abstraction, model policy, quotas, streaming and safety boundaries.
8. [Chat and generation](chat.md) — conversation persistence, SSE, stop, retry, regenerate and history.
9. [Users and administration](users.md) — roles, accounts, plans, invitations, sessions and auditability.

## How to answer in an interview

For each topic, prepare a 60–90 second answer using:
- **Context:** the user or engineering problem.
- **Decision:** what the application does and why.
- **Mechanism:** the request/data/control flow.
- **Trade-off:** what the approach improves and what it costs.
- **Evidence:** point to the source file, test, migration or workflow that proves it.

Do not claim a feature is production-proven because a test fixture passes. Distinguish implemented behavior, local demo setup, configured deployment, and integrations that require real credentials or external availability.

## Useful repository references

- [System architecture](../architecture.md)
- [End-to-end workflow](../user-workflow.md)
- [Technical diagrams](../diagrams/README.md)
- [Implementation boundaries](../implementation-status.md)
- [Backend boundaries and migrations](../../backend/README.md)
- [Repository setup and feature scope](../../README.md)

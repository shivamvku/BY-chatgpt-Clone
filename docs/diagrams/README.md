# Technical Diagrams

All diagrams use editable Mermaid source so reviewers can inspect and maintain them alongside code. They show logical architecture, not a substitute for checking actual Terraform, workflow and application configuration.

## Diagram catalogue

- [System architecture](system-architecture.md) — browser, API, generation, provider, database and Azure runtime.
- [End-to-end user workflow](user-workflow.md) — account setup, session, chat, history and settings.
- [Authentication and security](auth-security.md) — session cookie, CSRF, authorization and ownership.
- [Chat generation and streaming](chat-streaming.md) — message persistence, quota reservation, provider adapter and SSE.
- [Azure CI/CD and deployment](cicd-deployment.md) — PR validation, OIDC, image build, migration, rollout and smoke tests.
- [Logical data relationships](data-model.md) — key domain entities and ownership relationships (conceptual; confirm actual fields/constraints in models and migrations).

## Conventions

- Solid arrows represent request, data or control flow.
- Dashed arrows represent trust/configuration/secret-reference relationships.
- Browser-visible code must never receive provider API keys or database credentials.
- Azure resources and labels are based on the documented deployment design. Verify exact names, SKUs, region, ingress, private networking and role grants from current infrastructure code before operational use.
- Update diagrams in the same PR as changes to auth, streaming, schema or release workflows.

# YounderChat Documentation

This folder is the documentation home for the application. Start here, then follow the topic guides.

## Product and engineering guides

- [End-to-end user workflow](user-workflow.md) — registration/login through chat, history, settings, administration and logout.
- [System architecture](architecture.md) — component boundaries, request paths, data stores and Azure deployment.
- [Technical diagrams](diagrams/README.md) — Mermaid diagrams for architecture, workflows, auth, streaming, CI/CD and data relationships.
- [Interview preparation](prep/README.md) — topic-based question bank with answers and follow-up prompts.
- [Implementation status and limitations](implementation-status.md) — distinguish implemented behavior from external dependencies and non-goals.

## Existing documentation

- [Backend boundaries and database migrations](../backend/README.md)
- [Repository overview and local setup](../README.md)

## Documentation rules

1. Treat source code, tests, migration files and deployed workflow configuration as the source of truth.
2. Diagrams describe logical boundaries; confirm resource names, regions, SKU, network rules and identities against Terraform and workflow files before making operational changes.
3. Never document live secrets, tokens, connection strings, password-reset tokens, or production credentials.
4. Mark behavior that depends on external providers, email delivery, cloud configuration or account quotas.
5. Update this index and relevant diagrams whenever an API contract, security control, deployment resource or user journey changes.
6. Mermaid is used for editable, version-controlled diagrams. Keep node labels concise and include a short explanation below each diagram.

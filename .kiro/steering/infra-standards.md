---
inclusion: fileMatch
fileMatchPattern: ["infra/**/*", ".github/workflows/**/*", ".dockerignore"]
---
# Infrastructure and delivery standards

Manage all Azure application resources through Terraform. Do not create or edit resources manually in the portal or through ad hoc CLI commands. Use checked-in scripts for prerequisite provider registration and GitHub configuration; Azure CLI inspection is allowed. If drift requires import, document the existing resource and reconcile it into code.

Use the existing bootstrap, foundation, migration and application state boundaries. Store state remotely in Azure with locking and scoped access. State can contain secrets: never commit it or print sensitive outputs. Keep provider lockfiles, variable validation, naming and tags consistent. Keep real environment values out of committed examples.

Use Central US (`centralus`) for the agreed development environment. Recheck subscription availability and costs before changing region or SKU. Current development configuration uses B1ms PostgreSQL, 32 GB storage and Standard ACR to match benefits previously verified on this subscription; those benefits expire and are not universal. Avoid adding NAT gateways, static IPs, private endpoints, Redis or higher tiers without a concrete requirement and cost review.

Maintain private PostgreSQL networking, scoped inbound database rules, managed runtime identity, Key Vault secret references and HTTPS ingress. Keep ACR administrator access disabled. Prefer least-privilege roles and GitHub OIDC over stored cloud credentials. Document existing development tradeoffs rather than describing the scaffold as production hardened.

Budget target: INR 1,500 per month with 80% and 100% alerts. Budget alerts are notifications, not a hard spending cap. Include AI usage, logs, storage, backups and subscription-benefit expiry in cost reviews. Avoid always-on replicas for the development environment unless required.

Keep Dockerfiles and Compose under `infra/docker/`. Use multi-stage builds, locked dependencies, a non-root runtime and health probes. Bind local published ports to loopback. Local PostgreSQL defaults to host port 25432 and supports `POSTGRES_HOST_PORT`; container-to-container PostgreSQL remains on 5432.

Validate formatting, all changed Terraform roots and relevant mocked policy tests before planning. Review a saved Terraform plan before applying; apply only within the user's authorized deployment scope. Do not silently destroy databases, replace state or disable deletion protections. Treat plans as sensitive artifacts and do not reuse them after relevant configuration changes.

GitHub workflows must use pinned action revisions, minimal permissions and scoped OIDC environments. Build and deploy immutable image digests. Run migrations inside the VNet through the migration job; activate the app only after migration success. Keep deployment concurrency controlled and verify health after releases. Document rollback limitations when schema changes prevent reverting an image.

---
inclusion: fileMatch
fileMatchPattern: ["infra/**/*", ".github/workflows/**/*", ".dockerignore"]
---
# Infrastructure and delivery standards

Manage all Azure application resources through Terraform. Do not create or edit resources manually in the portal or through ad hoc CLI commands. Use checked-in scripts for prerequisite provider registration and GitHub configuration; Azure CLI inspection is allowed. If drift requires import, document the existing resource and reconcile it into code.

## Repository and safe cleanup

Before removing an infrastructure file, trace its references from Terraform roots, module sources, workflow steps, scripts, tests, documentation, and local operator commands. A file not called directly may still be a Terraform module, provider lockfile, backend example, policy input, test fixture, or documented recovery tool.

Treat each Terraform root as an independently stateful deployment boundary. Keep its provider lockfile and backend/state key. Do not merge roots, rename stateful resources, remove modules, or change resource addresses as a cleanup-only refactor without an explicit migration plan and reviewed Terraform plan. Never delete Azure resources merely to reduce repository size.

The optional database-access gateway is a real, cost- and security-sensitive capability controlled by `infra/config/db-access.json` and referenced by the foundation Terraform. Do not remove its module, scripts, policies, tests, or documentation without checking the current configuration and Terraform state, and confirming that the user no longer needs the gateway. Disabling or removing it can change billable resources and connectivity.

## Terraform and Azure

Use the existing bootstrap, foundation, migration, application and domains state boundaries. Store state remotely in Azure with locking and scoped access. State can contain secrets: never commit it or print sensitive outputs. Keep provider lockfiles, variable validation, naming and tags consistent. Keep real environment values out of committed examples.

Use Central US (`centralus`) for the agreed development environment. Recheck subscription availability and costs before changing region or SKU. Current development configuration uses B1ms PostgreSQL, 32 GB storage and Standard ACR to match benefits previously verified on this subscription; those benefits expire and are not universal. Avoid adding NAT gateways, static IPs, private endpoints, Redis or higher tiers without a concrete requirement and cost review.

Maintain private PostgreSQL networking, scoped inbound database rules, managed runtime identity, Key Vault secret references and HTTPS ingress. Keep ACR administrator access disabled. Prefer least-privilege roles and GitHub OIDC over stored cloud credentials. Document existing development tradeoffs rather than describing the scaffold as production hardened.

Budget target: INR 1,500 per month with 80% and 100% alerts. Budget alerts are notifications, not a hard spending cap. Include AI usage, logs, storage, backups and subscription-benefit expiry in cost reviews. Avoid always-on replicas for the development environment unless required.

## Docker and CI/CD

Keep Dockerfiles and Compose under `infra/docker/`. Use multi-stage builds, locked dependencies, a non-root runtime and health probes. Bind local published ports to loopback. Local PostgreSQL defaults to host port 25432 and supports `POSTGRES_HOST_PORT`; container-to-container PostgreSQL remains on 5432.

Validate formatting, all changed Terraform roots and relevant mocked policy tests before planning. Review a saved Terraform plan before applying; apply only within the user's authorized deployment scope. Do not silently destroy databases, replace state or disable deletion protections. Treat plans as sensitive artifacts and do not reuse them after relevant configuration changes.

GitHub workflows must use pinned action revisions, minimal permissions and scoped OIDC environments. Build and deploy immutable image digests. Run migrations inside the VNet through the migration job; activate the app only after migration success. Keep deployment concurrency controlled and verify health after releases. Document rollback limitations when schema changes prevent reverting an image.

Prefer removing only demonstrably unreferenced files. If every infrastructure file has an active runtime, test, state, or documented operator purpose, keep it and report that no safe deletion was identified rather than deleting active infrastructure speculatively.
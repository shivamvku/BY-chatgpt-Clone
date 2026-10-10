# Development deployment: 8 October 2026

> Historical snapshot of the infrastructure state on this date, not a statement of current deployment status. See [the implementation plan](../../docs/implementation-plan.md) and the latest GitHub Actions release run for current verification.

## Bootstrap

The Central US bootstrap was reviewed and applied through Terraform. Two resource groups, state storage, GitHub plan/deploy identities, federation and scoped roles were created. State migration to Azure Blob Storage succeeded; a subsequent plan reported no changes.

The first storage check failed because the provider attempted shared-key authentication. The provider now uses Azure AD, with operator blob access assigned on the dedicated state resource group before storage creation. Recovery used Terraform plans and import, without deleting or manually editing Azure resources. Local recovery state and backend configuration are ignored by Git.

## Foundation

The reviewed saved plan contained 24 additions, no updates and no deletions. Formatting, validation and both mocked network/registry policy tests passed before apply. Apply succeeded with 24 additions; the Container Apps environment took 13 minutes 47 seconds to provision.

Verified through Azure CLI:

- VNet and delegated application/database subnets: succeeded; default Azure DNS.
- PostgreSQL 16: ready, B1ms, 32 GB storage, seven-day backups, public access disabled. The `chat` database was created.
- Standard Container Registry: succeeded; administrator login disabled.
- Key Vault: succeeded; RBAC and purge protection enabled. Database secret exists and is enabled; secret values were not printed during verification.
- Logging workspace, runtime identity and scoped registry/vault roles were created.
- Container Apps environment: succeeded, VNet-integrated and Consumption-only.
- Resource-group budget: INR 1,500 monthly with actual-cost notifications at 80% and 100%. Alerts do not cap spending; bootstrap storage lives outside this resource-group budget, and AI billing may also be separate.

The final full Terraform plan reports no changes. The initial drift check exposed Azure-generated defaults that would have triggered an unnecessary environment replacement. Configuration now explicitly records the environment's managed resource-group name and zero Consumption profile counts, and preserves PostgreSQL's automatically assigned zone. No replacement was applied. Database connectivity from a running Azure app remains unverified until the migration/application release.

## GitHub configuration

The checked-in `Configure-GitHub.ps1` script configured nonsecret Azure identifiers and the budget alert contact. The `infra-plan` and `infra-deploy` environments exist and allow deployment from `main`. Required reviewers are not configured. The OIDC federation subjects match these environment names.

Source changes have not been committed or pushed in this session. GitHub workflows and application release have not run end to end. Migration and application Terraform roots remain unapplied.

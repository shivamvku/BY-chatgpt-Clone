# Infrastructure and deployment

All application resources are defined in Terraform. No portal-created application resources are required. The Central US bootstrap and foundation were applied on 8 October 2026, with Azure remote state and final plans reporting no changes. GitHub OIDC variables and deployment environments are configured. Migration and application deployment remain pending. See [deployment verification](docs/deployment-2026-10-08.md).

Cost preflight: the portal now confirms unused PostgreSQL B1ms/32 GB database/32 GB backup allowances and 31 days/month of Standard registry usage. Development now selects Standard to match that meter. These allowances can cover the database and registry baseline while eligible and within limits; app compute, logs, backups beyond the allowance, operations, data transfer and AI remain variable. Remaining trial credit is still unverified. Review [the preflight report](docs/preflight-2026-10-08.md) before applying; the INR 1,500 budget alert does not enforce a spending limit.

## State boundaries

1. `bootstrap/`: state storage, app resource group, GitHub plan/deploy identities, federation and scoped roles. Run once as a subscription administrator. It starts with local state; the apply wrapper migrates it to the newly created remote backend. Protect any residual local backups.
2. `terraform/environments/dev/foundation/`: VNet, delegated subnets, private PostgreSQL/DNS, identities, registry, vault, logging, optional budget and Container Apps environment.
3. `terraform/environments/dev/migrations/`: private-network migration job using the release image.
4. `terraform/environments/dev/application/`: HTTPS ingress, app container, health probes and bounded scaling.

After bootstrap migration, all four roots use Azure remote state with leases, versioning and soft delete. Keys are `bootstrap.tfstate`, `dev/foundation.tfstate`, `dev/migrations.tfstate`, and `dev/application.tfstate`. Deployment workflows share a concurrency group; Terraform locking protects each state independently.

## Networking

The VNet is `10.42.0.0/16`. The app subnet is `10.42.0.0/23`; PostgreSQL is `10.42.2.0/24`. PostgreSQL public access is disabled. Its NSG permits app-to-database TCP 5432 and intra-database operations, then denies other inbound traffic. Outbound platform dependencies retain Azure defaults.

The Container Apps subnet intentionally has no NSG: public workload-profile ingress bypasses subnet inbound rules, and subnet NSGs introduce additional requirements for public registry connectivity. Public app traffic is controlled by HTTPS-only ingress. The database NSG does not filter public app traffic. A static public/egress IP and NAT Gateway are unnecessary for this development configuration.

Sources: [Container Apps NSG behavior](https://learn.microsoft.com/en-us/azure/container-apps/firewall-integration), [VNet requirements](https://learn.microsoft.com/en-us/azure/container-apps/custom-virtual-networks).

## Identity and development trade-offs

- Runtime identity: AcrPull and Key Vault Secrets User. Registry administrator login is disabled.
- Plan identity: resource-group Reader, state Blob Data Contributor for locking, and vault Secrets User for refresh. PR checks receive no Azure identity.
- Deploy identity: resource-group Contributor and scoped RBAC Administrator, AcrPush, vault Secrets Officer and state access. RBAC administration permits role changes within this resource group; production should use conditioned assignments.
- Key Vault and Standard ACR retain public service endpoints protected by Azure authorization. They are not private-endpoint deployments. Database connections are private and require TLS. Reassess the registry SKU after the free benefit expires; Standard retail pricing is higher than Basic.
- Terraform state and saved plans contain generated database credentials. Treat state access as sensitive; do not expose it to untrusted jobs or upload plans as public artifacts.
- The scaffold stores an administrator database connection in Key Vault. Before implementing a public chat/auth release, introduce a restricted runtime database role separate from migration privileges.
- State storage shared-key access is disabled. Backend authentication uses Entra ID. PostgreSQL and state storage have deletion guards; teardown requires deliberate code changes.
- PostgreSQL backups retain seven days. Logs retain thirty days with a 1 GB daily ingestion quota. App replicas range from zero to two. These are development defaults.
- Selected budget is INR 1,500/month, with actual-cost notifications at 80 percent (INR 1,200) and 100 percent (INR 1,500). Alerts do not cap spending. Azure's active billing profile was verified as INR. Versioned policy is `config/budget.json`; local foundation configuration must match it. The start date must be the first day of a month.

## Validate without provisioning

```powershell
terraform fmt -check -recursive infra
foreach ($stack in @('infra/bootstrap', 'infra/terraform/environments/dev/foundation', 'infra/terraform/environments/dev/migrations', 'infra/terraform/environments/dev/application')) {
    terraform "-chdir=$stack" init -backend=false -input=false -lockfile=readonly
    terraform "-chdir=$stack" validate
}
terraform -chdir=infra/terraform/environments/dev/foundation test
```

Provider versions/checksums are committed in lockfiles. Network tests use mocked Azure providers and create no resources.

## Bootstrap sequence: creates billable infrastructure

Central US (`centralus`) is the selected region. The read-only preflight lists PostgreSQL B1ms/version 16 there; capacity is not reserved. Confirm budget and review the saved plan before applying.

```powershell
az login
az account set --subscription '<subscription-id>'
./infra/scripts/Register-Providers.ps1
Copy-Item infra/config/bootstrap.tfvars.example infra/config/bootstrap.tfvars
# Edit the copied configuration: subscription, region, app name and GitHub repository.
./infra/scripts/Terraform.ps1 -Stack bootstrap -Action init
./infra/scripts/Terraform.ps1 -Stack bootstrap -Action validate
./infra/scripts/Terraform.ps1 -Stack bootstrap -Action plan -VariablesFile infra/config/bootstrap.tfvars -PlanFile bootstrap.tfplan
terraform show bootstrap.tfplan
# Only after reviewing the saved plan:
./infra/scripts/Terraform.ps1 -Stack bootstrap -Action apply -PlanFile bootstrap.tfplan
terraform -chdir=infra/bootstrap output
```

RBAC propagation can delay storage-container and vault-secret access after new assignments. Wait and retry if Azure reports a transient authorization failure; do not bypass authorization or enable shared storage keys.

Copy `backend` output values to ignored `infra/config/backend.hcl`, using its example. Copy `foundation_inputs` to ignored `infra/config/foundation.tfvars`, using its example; add subscription/name and an optional budget.

```powershell
./infra/scripts/Terraform.ps1 -Stack foundation -Action init -BackendFile infra/config/backend.hcl
./infra/scripts/Terraform.ps1 -Stack foundation -Action plan -VariablesFile infra/config/foundation.tfvars -PlanFile foundation.tfplan
terraform show foundation.tfplan
./infra/scripts/Terraform.ps1 -Stack foundation -Action apply -PlanFile foundation.tfplan
```

Never commit state, real variable files, saved plans or credentials. The apply wrapper invokes `Migrate-BootstrapState.ps1`, which refuses to overwrite an existing remote state blob and generates an ignored bootstrap backend definition. If applying Terraform directly, run that migration script afterward. Migration and backend locking were verified against Azure on 8 October 2026. On a new checkout, restore the backend definition from its example and initialize using the saved backend configuration with key `bootstrap.tfstate`; do not start a second local bootstrap.

The bootstrap provider uses Azure AD for storage data access because shared keys are disabled. The operator receives Storage Blob Data Contributor on the dedicated state resource group before storage creation; GitHub identities receive that role only on the state account. During the first apply, a missing Azure AD provider setting caused a failed storage check and incomplete provider identity metadata. Recovery used a reviewed Terraform plan for the operator role, a protected local state backup, re-import of the existing account, and a full recovery plan. No resources were deleted or manually edited in Azure.

## GitHub setup and release

After bootstrap, authenticate GitHub CLI and run:

```powershell
gh auth login
./infra/scripts/Configure-GitHub.ps1
```

The script configures non-secret Azure identifiers as repository variables and creates `infra-plan` / `infra-deploy` environments restricted to the repository's default branch. It does not configure required reviewers. Federation subjects match these environment names exactly. See the implementation plan for verified workflow execution and current deployment status.

GitHub repositories created after 15 July 2026 use immutable OIDC subjects containing owner and repository IDs. Set bootstrap `github_repository_subject` to `OWNER@OWNER_ID/REPO@REPO_ID`; obtain the IDs using `gh api repos/OWNER/REPO --jq '{owner_id: .owner.id, repository_id: .id}'`. The example contains verified IDs for this repository. Leave this variable null only for a repository that still uses the legacy names-only subject. Federation remains restricted to the exact `infra-plan` / `infra-deploy` environment. See [GitHub's OIDC reference](https://docs.github.com/en/actions/reference/security/oidc).

The configuration script sets `AZURE_BUDGET_ALERT_EMAIL` from your signed-in Azure account, or from its explicit `-BudgetEmail` parameter. The infrastructure workflow combines this contact with the versioned `config/budget.json` policy. Missing contact configuration fails the workflow rather than silently omitting the budget. No notification email is committed in the repository. Check billing currency again if using another subscription; `expected_currency` documents the verified currency and does not change Azure's currency.

Workflows:

- `ci.yml`: backend lint/tests, frontend build, Terraform validation/network tests and Docker build. No Azure credentials in PR jobs.
- `infrastructure.yml`: manually select foundation plan or apply. Apply generates and consumes a plan in one run. Inspect a plan-only run first; this is not immutable cross-run plan approval.
- `deploy.yml`: manual release from the default branch. Reruns checks, builds a commit-tagged image on the GitHub runner, pushes it to ACR using Azure OIDC authentication, resolves its immutable digest, applies the migration-job root, runs/waits for migrations, then applies the app root and checks readiness/frontend. Both roots use the same digest. This avoids relying on ACR Tasks availability for trial-credit subscriptions; see [Microsoft guidance](https://learn.microsoft.com/en-us/answers/questions/1528748/push-with-acr-task-are-not-permitted).

All resources remain Terraform-managed. Image builds, job starts and smoke requests are operational actions. The migration job reaches PostgreSQL inside the VNet; GitHub-hosted runners cannot directly connect to it.

Use backwards-compatible migrations: the old revision remains live while migration runs. Failed migrations stop rollout. Failed smoke checks fail the release; automatic rollback is not implemented. To roll back, redeploy a known image through the app Terraform root. Database downgrades require a separate review.

Pipeline execution requires bootstrap, foundation outputs, repository variables and service capacity. See the implementation plan for current deployment verification.

## Application foundation update

Before releasing this application branch, plan/apply the updated foundation. It adds a distinct migration identity and runtime database secret, restricts web-runtime Key Vault access, and exports application/model settings. The migration job uses administrator credentials only inside the VNet, runs `python -m app.db.migrate`, and provisions the restricted runtime role. Application rollout follows successful migrations. Applying only the application root against old foundation outputs will fail.

Model policy lives in `config/ai.json`, disabled by default. After an eligible subscription and model quota/pricing are verified, enable it in a reviewed commit, register Microsoft.CognitiveServices through the checked-in provider script, and run the read-only quota check and foundation plan. The infrastructure workflow rejects enabled AI with no verified matching quota. Keep model capacity low, use keyless runtime RBAC, and review the saved plan before apply. Model catalog availability alone is not subscription eligibility.

App origins/session limits/request/token limits live in `config/app.json`. The Azure hostname is added to allowed origins by Terraform alongside the custom domain. No credentials belong in either JSON file. Budget alerts are not a hard limit; per-user/app-wide token reservations provide additional application controls.

The branch is for review and CI; deployment environments remain restricted to main. Do not bypass that restriction to deploy the branch.

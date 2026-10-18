# Azure retirement and complete shutdown plan

This is the proposed shutdown path for the YounderChat development deployment. It is source-controlled infrastructure automation, not a portal procedure. The teardown command is read-only by default; its safety tests run in CI with a mocked Azure CLI, and CI never runs destructive execution. Keep this PR unmerged and do not execute teardown until the owner has verified the subscription allowlist, inventory and backups.

## Azure inventory

The deployment has two Azure resource groups.

| Resource group | Terraform roots | Services removed |
| --- | --- | --- |
| `bychat-dev-rg` | `foundation`, `migrations`, `application`, `domains` | Container App, scheduled retention job, migration/operator jobs, Container Apps environment, Azure Container Registry, PostgreSQL Flexible Server and `chat` database, Key Vault and secrets, Log Analytics, budget, VNet, delegated subnets, NSGs, private DNS zone/link, managed identities and RBAC. If enabled, the DB-access VM, NIC, managed disk, public IP, shutdown schedule, subnet and NSG are included. |
| `bychat-dev-tfstate-rg` | `bootstrap` | Terraform state storage account, `tfstate` container, state versions, and state-access RBAC. |

The bootstrap root deliberately uses `prevent_destroy` on the state account. Resource-group deletion is the final mechanism for removing the bootstrap group and remote state together. The checked-in `infra/pipelines/teardown.sh` requires two separate invocations: one to delete only the application group, then a second state-deletion invocation after the owner verifies the app group is absent and reviews the state inventory.

The teardown script pins the expected project subscription ID and refuses to proceed unless the active subscription, `ARM_SUBSCRIPTION_ID`, and `TEARDOWN_ALLOWED_SUBSCRIPTION_ID` all match that pinned value. It also requires both resource-group names to match the exact allowlist in the script, both groups to carry `project=by-chat`, and the state storage account to be located in the expected state group. It also blocks if it finds project-tagged resources in other resource groups. The tag query is not proof that no untagged resources exist: inspect the full subscription inventory and identify project ownership manually before execution. Any additional project-owned resources outside the two allowlisted groups must be separately reviewed and removed before this script can run.

The following are outside these Azure groups and must be handled separately:

- GoDaddy DNS records for `aichat.sdigurukulam.in`.
- GitHub Actions variables, secrets, environments, and OIDC configuration references.
- Azure subscription provider registrations, billing history, Entra directory objects outside the groups, and external Gemini, Groq, and Resend accounts.

## Shutdown sequence

1. Pause releases and tell users the service will retire. Do not merge or dispatch an Application release while teardown is in progress.
2. Preserve data that must survive deletion. Export PostgreSQL data and any retained user image files to an approved encrypted location. Keep an independent record of the deployed image digest and Azure resource inventory. Do not export Terraform state to a workstation or attach it to a ticket: it can contain credentials.
3. Remove the custom-domain records at GoDaddy after the service is no longer needed. This prevents a dangling DNS record after the Container App is deleted.
4. Authenticate with an Azure principal that can delete both resource groups. Verify that the subscription ID pinned in `infra/pipelines/teardown.sh` is still the intended project subscription. Set both `TEARDOWN_ALLOWED_SUBSCRIPTION_ID` and `ARM_SUBSCRIPTION_ID` to that exact value. Also set `AZURE_APP_NAME`, `AZURE_RESOURCE_GROUP=bychat-dev-rg`, `TF_STATE_RESOURCE_GROUP=bychat-dev-tfstate-rg`, and the exact `TF_STATE_STORAGE_ACCOUNT` name. Do not change the pinned subscription unless the owner independently verifies the intended subscription and reviews the change.
5. Run the mocked safety tests locally before the read-only inventory. These tests make no Azure calls:

   ```bash
   bash infra/pipelines/test-teardown.sh
   ```

   Then run the read-only inventory:

   ```bash
   bash infra/pipelines/teardown.sh --plan
   ```

6. Review the listed groups and resources. Verify the subscription ID, application name, data export, and external DNS plan with the service owner.
7. Delete only the application resource group. This command does not delete Terraform state:

   ```bash
   bash infra/pipelines/teardown.sh --execute-app \
     --confirm-app "$AZURE_APP_NAME" \
     --backup-confirmed
   ```

8. Verify the application group is absent, rerun `--plan`, and review the remaining state inventory. Only after that separate review, delete the Terraform state group in a second invocation:

   ```bash
   bash infra/pipelines/teardown.sh --execute-state \
     --confirm-state-group "$TF_STATE_RESOURCE_GROUP" \
     --state-destruction-confirmed
   ```

   This final step irreversibly removes remote Terraform state. It requires its own explicit confirmation and refuses to run while the application group still exists.

9. Verify both resource groups are absent with `az group exists`, then run a subscription-wide `az resource list --subscription "$ARM_SUBSCRIPTION_ID" -o table` inventory and confirm no project-owned resources remain. Inspect resources that are not tagged, as the script cannot infer ownership from names alone. Remove unused GoDaddy DNS records and, once the project is permanently retired, GitHub deployment variables/secrets and environments. Review subscription-level provider registrations and Entra objects separately; do not unregister shared providers or delete shared identities.

## Recovery limits

Resource-group deletion is irreversible for the running application. PostgreSQL backups, Key Vault soft deletion/purge protection, and storage soft deletion may delay name reuse or permit provider-level recovery during their configured retention windows, but they are not a recovery plan. Recreating YounderChat requires a fresh bootstrap, new state backend, new identities, and restored application data.

## Why this does not use `terraform destroy`

The Terraform roots intentionally protect PostgreSQL and Terraform state with `prevent_destroy`. Removing those protections only to delete the groups would weaken normal safety guarantees and would still leave the backend's self-deletion problem. Deleting the two tagged resource groups through this reviewed script gives Azure the complete dependency graph and retains an explicit, auditable teardown boundary.

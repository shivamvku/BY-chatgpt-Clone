# CI/CD and Azure Deployment Diagram

~~~mermaid
flowchart TD
  Dev[Developer push / pull request] --> GH[GitHub Actions]
  GH --> FE[Frontend lint, unit tests and build]
  GH --> BE[Backend lint and tests]
  GH --> BR[Browser / Playwright tests with isolated test DB]
  GH --> INFRA[Infrastructure and workflow validation]
  FE --> Gate{Required checks pass?}
  BE --> Gate
  BR --> Gate
  INFRA --> Gate
  Gate -->|No| Stop[Fail workflow; do not release]
  Gate -->|Yes, PR| Review[Review and merge]
  Review --> Main[Main branch release workflow]
  Main --> OIDC[GitHub OIDC federation]
  OIDC --> Identity[Scoped Azure identity]
  Main --> Image[Build container image]
  Image --> ACR[Azure Container Registry]
  Main --> TF[Terraform plan/apply as configured]
  TF --> ACA[Azure Container Apps]
  TF --> PG[Azure Database for PostgreSQL]
  Identity --> KV[Key Vault / managed identity]
  ACR --> ACA
  Main --> Migration[Run database migrations]
  PG --> Migration
  Migration --> Deploy[Deploy application revision]
  Deploy --> ACA
  ACA --> Smoke[Health and smoke checks]
  Smoke --> Result{Smoke checks pass?}
  Result -->|Yes| Done[Release workflow successful]
  Result -->|No| Alert[Fail release; inspect logs and revision]
~~~

## Release safety checklist

- Review required checks and job logs, not only the overall workflow badge.
- Confirm the workflow's trigger/branch filters and environment approvals before changing release behavior.
- Prefer OIDC federation and scoped identities over long-lived Azure client secrets where configured.
- Keep database migration and runtime credentials separate; the application should use the restricted runtime role.
- Apply backward-compatible schema changes where possible; deploy migrations before code that requires the new schema.
- Check image tag/digest, deployed revision, migration output and post-deploy health/smoke results.
- A successful workflow proves the configured pipeline steps passed. It does not prove real provider inference, email delivery or every UI path unless those are explicitly exercised.

Exact resource names, region, SKU, network rules and identity permissions must be verified in current `infra/` and `.github/workflows/` files.

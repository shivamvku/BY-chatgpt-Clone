# CI/CD and DevOps — Interview Q&A

## 1. Describe the delivery pipeline.

**Answer:** Pull-request checks validate frontend, backend, browser flows and infrastructure/configuration as defined in the workflows. The production path uses GitHub Actions with OIDC-based Azure identity, builds and pushes an image to ACR, runs database migrations, deploys to Azure Container Apps and executes smoke checks. Always inspect the current workflow YAML and run logs for exact job order and branch filters.

## 2. Why use OIDC instead of a long-lived Azure secret?

**Answer:** OIDC exchanges a GitHub Actions identity token for short-lived cloud credentials based on a configured federation trust. It reduces stored long-lived credentials, but only when subject/audience conditions and Azure role scopes are correctly restricted.

## 3. What does Terraform provide?

**Answer:** Declarative, reviewable infrastructure configuration and repeatable plans. State must be protected and locked appropriately, and changes should be reviewed before apply. Terraform is not a substitute for monitoring runtime health or testing application behavior.

## 4. Why deploy an immutable container image?

**Answer:** A fixed image digest identifies exactly what was built and allows release traceability. Avoid relying on a mutable tag alone for reproducibility. Record the image/revision associated with migration history where supported.

## 5. How do you handle database migrations?

**Answer:** Create a new immutable Alembic revision, review generated SQL and constraints, test upgrading a fresh schema, and consider compatibility with the currently deployed code. Release migration runs before deploying code that depends on it. Use separate migration/admin and restricted runtime DB roles; destructive downgrades are disabled in the documented setup.

## 6. What should a smoke test verify?

**Answer:** Critical runtime health and a minimal application response after rollout, with bounded timeouts. A health check should not expose secrets or depend unnecessarily on every external provider. Separate health, readiness and end-to-end synthetic checks according to their purpose.

## 7. What is rollback strategy?

**Answer:** Roll back application revisions when compatible, but do not assume database schema can always be rolled back safely. Prefer expand-and-contract migrations and forward fixes for destructive/data transformations. Document who can initiate rollback and what state must be preserved.

## 8. Why can CI pass while production is broken?

**Answer:** Tests may use mocks, deterministic LLM fixtures, SQLite or isolated databases. Production may have bad secrets, identity permissions, network rules, model quota, DNS, schema drift or provider outages. CI, deployment health, integration tests and real user workflows provide different evidence.

## 9. How do you secure CI/CD?

**Answer:** Use least-privilege workflow permissions, OIDC federation with restrictive trust conditions, protected branches/environments, pinned/reviewed actions, dependency scanning, secret redaction and auditable release artifacts. Never echo credentials or inject secrets into build arguments that persist in image layers.

## 10. What observability belongs in a release?

**Answer:** Workflow/job status, commit and image digest, migration revision, deployed app revision, startup errors, health/smoke results and post-release error/latency metrics. A green deployment job is not enough without checking the deployed revision and user-visible behavior.

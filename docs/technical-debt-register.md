# Technical Debt Register and Remediation Plan

**Baseline:** `main` at the time this audit branch was created  
**Status:** Findings are engineering risks to verify and remediate; not every item is a confirmed production incident.  
**Compatibility requirement:** Preserve existing REST contracts, SSE event names/payloads, browser flows, database data, auth/session behavior, and visual design. Make schema changes only with backward-compatible migrations and explicit rollout plans.

## How to use this register

- **P1 — high priority:** security, accounting correctness, cross-replica behavior, or deployment safety.
- **P2 — medium priority:** reliability, scale, data integrity, operations, and maintainability.
- **P3 — lower priority:** cleanup, documentation drift, and quality-of-life improvements.
- Mark an item done only after code, tests, and operational evidence support closure. A green CI run does not by itself prove production connectivity or provider availability.
- Do not add Redis, new cloud services, or paid infrastructure solely to hide an architectural limitation. Prefer database-backed coordination, explicit constraints, or documented behavior until requirements justify a new dependency.

## P1 — high priority

### TD-01 — Usage reservation accounting
**Observed risk:** Chat submission reserves a conservative token amount in per-user usage, a subscription-wide usage event, and a global daily rate bucket. Generation status is updated, but the accounting lifecycle does not clearly reconcile reserved amounts against final provider usage or release unused reservations after failure/stop. This can make quotas drift or stay consumed after abandoned work.

**Remediation:** Define one canonical accounting lifecycle (reserved → settled/released), make settlement idempotent, handle complete/failed/stopped/timeout/disconnect states, and avoid releasing global capacity without a consistent policy. Provider token usage may be unavailable; in that case retain a clearly documented conservative estimate. Add concurrency, duplicate-request, retry, and interrupted-generation tests before changing counters.

**Acceptance:** Each generation is accounted exactly once; failed/stopped requests follow documented quota policy; repeated settlement is harmless; concurrent requests cannot exceed configured caps.

### TD-02 — WebSocket origin validation
**Observed risk:** The cookie-authenticated WebSocket endpoint checks session identity but does not visibly enforce the configured `ALLOWED_ORIGINS` list at handshake time. Browsers can attach cookies to cross-site WebSocket handshakes, creating a potential cross-site WebSocket hijacking risk.

**Remediation:** Validate the handshake `Origin` against the same normalized allowlist used by HTTP mutation protection, with explicit behavior for absent Origin (non-browser clients) and tests. Reject disallowed browser origins before accepting the socket; do not weaken cookie/session checks.

**Acceptance:** Allowed origins still connect; disallowed and malformed origins are rejected; unauthenticated clients remain rejected; ping/session-check payloads are unchanged.

### TD-03 — Cross-replica WebSocket semantics
**Observed risk:** WebSocket connections are held in process memory while Container Apps allows up to two replicas. A notification emitted by one replica cannot reach a client connected to another replica. Current behavior must not be treated as a distributed event bus.

**Remediation:** First inventory every producer/consumer of manager notifications. If the socket is only a session convenience, document best-effort semantics and ensure REST/session refresh remains authoritative. If cross-replica delivery is required, design a durable or shared transport only after confirming the need and cost; do not silently introduce a new paid dependency.

**Acceptance:** Product behavior remains correct regardless of replica placement; any best-effort behavior is explicit; distributed delivery is covered by integration tests if implemented.

### TD-04 — Deployment readiness and database connectivity
**Observed risk:** Deployment notes recorded that application/database connectivity had not yet been verified. CI success is not equivalent to a deployed app successfully authenticating to PostgreSQL, reading Key Vault references, or passing readiness checks.

**Remediation:** Add a deployment smoke gate after deployment that checks readiness and a minimal authenticated/database-backed flow without exposing secrets or mutating real user data. Confirm runtime DB privileges and migration ordering in the actual Azure environment. Do not promote a release on build/test success alone.

**Acceptance:** Deployment is considered verified only after a successful live smoke check and recorded release/image/migration identifiers.

## P2 — medium priority

### TD-05 — Generation lifecycle and recovery
Review pending/streaming/stopping/stopped/complete/failed transitions, worker/process restarts, disconnect cancellation, timeout handling, and duplicate stream claims. Ensure stale generations can be recovered without accidentally running a second provider request. Add transition-table tests and a safe recovery mechanism.

### TD-06 — Message branch integrity
`messages.parent_id` is a nullable string rather than a database-enforced self-reference. Application validation checks the branch, but malformed/cross-conversation parents can still be introduced by a bug or direct database write. Add tests for cycles, foreign-conversation parents, missing parents, and ordinal conflicts. Evaluate a self-FK and same-conversation constraint via a backward-compatible migration; a simple FK alone cannot enforce same-conversation parentage.

### TD-07 — Retention job resilience and visibility
Retention is batch-bounded and runs on a schedule, but failures/retries/partial completion need explicit operational handling. Make batches idempotent, ensure failures are observable, document the timezone/cron semantics, and alert on repeated failure or excessive backlog. Preserve auditability without logging personal content.

### TD-08 — Database attachment storage growth
Attachments are stored as binary data in PostgreSQL. This is simple and transactional for a small assignment but increases database size, backup/restore time, and I/O as usage grows. Measure current limits and costs before moving data; any future object-storage migration needs authenticated access, cleanup, quotas, and a dual-read/rollback strategy.

### TD-09 — Query and index coverage
Review history/search/branch/usage/subscription/retention query plans and pagination bounds using realistic data. Add only indexes supported by query plans and migration tests; avoid speculative indexes that increase write costs.

### TD-10 — Runtime connection pool vs replica/DB capacity
Each non-SQLite engine is configured with a pool of five plus five overflow connections. With multiple replicas and background jobs, total possible connections can exceed a small database tier's practical budget. Document the connection budget, tune pool settings to the target PostgreSQL limit, and test under concurrent requests.

### TD-11 — Rate-limit and quota concurrency tests
Verify rate bucket upserts, user/subscription locks, daily boundaries, idempotent request IDs, and global allowance behavior on PostgreSQL (not only SQLite). Define behavior when a transaction fails after a reservation attempt and ensure no partial accounting is committed.

### TD-12 — Frontend SSE parser robustness
The stream parser handles newline-delimited events but should be tested for chunk boundaries, trailing buffers, CRLF, malformed payloads, disconnects, and abort/stop races. Keep event names and payload shape backward compatible; ensure the final persisted response is fetched without a loading flash.

### TD-13 — Markdown and rich-content security
Review markdown rendering, link protocols, image URLs, chart parsing, and any HTML-enabled render path. Keep raw HTML disabled or sanitized, reject unsafe schemes, and add XSS regression tests without changing legitimate Markdown output or chart UX.

### TD-14 — Container App scale and revision strategy
Current Terraform uses single-revision mode, zero minimum replicas, and up to two replicas. Cold starts and in-memory state limitations should be explicit. Evaluate min replicas and blue/green revision options against budget and availability requirements; do not change cost-affecting settings without a measured decision.

### TD-15 — Image pinning and infrastructure reproducibility
The database-access VM uses an Ubuntu image version of `latest`, which reduces reproducibility. Pin a validated image version and provide a deliberate update process. Ensure app images are immutable commit/digest references, not mutable tags, for release promotion.

### TD-16 — Terraform state and environment drift
Foundation/application roots use remote state and can be applied separately. Document dependency ordering, locking, ownership, drift detection, and recovery. Keep secrets out of outputs/logs and verify state access follows least privilege.

### TD-17 — Database roles and migration safety
Verify the runtime role cannot perform schema changes and the migration role has only required privileges. Test migration against a production-like PostgreSQL instance and document forward/rollback compatibility. Avoid destructive migrations in the same release that first stops reading the old schema.

### TD-18 — Upload limits and content validation
Review request-body buffering, image re-encoding, MIME sniffing, decompression/pixel limits, per-user storage accounting, and concurrent uploads. Keep API limits aligned across proxy, ASGI middleware, and upload handlers.

### TD-19 — Component/state boundaries
Review chat state ownership, optimistic updates, query invalidation, stream cancellation, and component size. Refactor only with characterization/browser tests so message branching, regeneration, stop, and landing-state behavior remain unchanged.

### TD-20 — Browser and load coverage
Add regression coverage for concurrent generations, multiple tabs, branch/regenerate flows, uploads, expired sessions, rate limiting, interrupted streams, and a scaled deployment. Use deterministic fake providers for normal CI; keep real-provider tests opt-in.

## P3 — lower priority

### TD-21 — Documentation and runtime drift
Keep README, architecture docs, configuration comments, Terraform outputs, deployment runbooks, and CI behavior aligned. Remove obsolete model environment settings only with a deprecation note and tests.

### TD-22 — Release governance
Document branch protection, required checks, review expectations, migration approvals, artifact provenance, and post-deploy smoke checks. Ensure deployment workflows cannot accidentally deploy an unreviewed feature branch.

### TD-23 — Operational observability
Add low-cardinality metrics for request outcomes, generation state transitions, provider latency/status, quota rejections, database pool timeouts, retention counts/failures, and readiness. Never log tokens, cookies, prompt bodies, uploaded content, or provider secrets.

## Remediation order

1. Add this register and tests that characterize existing behavior.
2. Address security and accounting correctness (TD-01, TD-02) with focused changes and regression tests.
3. Validate generation and branch invariants (TD-05, TD-06) with migrations only if proven safe.
4. Improve retention, query/pool behavior, stream robustness, and rendering security.
5. Harden CI/deployment verification and document remaining infrastructure decisions.
6. Reassess scale/cost architecture from measurements rather than introducing services pre-emptively.

## Definition of done

- Existing UI layout/theme and user flows are unchanged unless a separately approved UX change is needed.
- Existing REST routes, request/response schemas, SSE events, and session cookie semantics remain compatible.
- Any database change includes a migration, migration tests, and a forward-compatible rollout plan.
- Relevant unit/integration/browser tests, lint, formatting, and production build pass.
- Terraform is formatted and validated; no infrastructure is applied automatically by this remediation branch.
- Remaining unverified operational risks are explicitly documented rather than reported as fixed.

## Current remediation evidence (2026-10-12)

This section separates code changes from validation that still requires a real PostgreSQL/Azure environment. Items are **not closed** until their acceptance criteria above have supporting evidence.

| Item | Current evidence | Remaining closure gate |
|---|---|---|
| TD-01 | Reservation release is idempotent for failed/stopped generations; stale-generation and late-persist regression tests exist. | PostgreSQL concurrency tests for competing requests and rollback behavior. |
| TD-02 | WebSocket Origin allowlist enforcement and allowed/disallowed-origin tests. | Verify production ALLOWED_ORIGINS values and malformed-origin behavior in deployment. |
| TD-03 | Process-local WebSocket behavior is documented as best effort; REST/session state remains authoritative. | Confirm product requirements do not depend on cross-replica notification delivery. |
| TD-04 | Readiness now checks the application tables; deployment smoke also calls the database-backed session endpoint. | Run the deployment smoke against Azure and record image/schema identifiers. |
| TD-05 | Terminal generation states are protected from late writes; stale work is reconciled. | Add/execute restart and duplicate-provider-claim coverage under PostgreSQL. |
| TD-06 | Added tests for missing/cross-conversation parents, cycles, and duplicate ordinals. | A self-reference/same-conversation database constraint remains deferred until a safe migration and rollout are designed. |
| TD-07 | Scheduled retention job has bounded retries and emits structured completion/failure logs. | Verify Azure job failures/retries and define an alert/backlog threshold. |
| TD-08 | Upload size and per-user storage limits exist; attachments remain in PostgreSQL. | Measure database growth/backup cost before deciding whether to migrate storage. |
| TD-09 | Existing query bounds and indexes are documented in the register. | Capture realistic PostgreSQL query plans before adding indexes. |
| TD-10 | PostgreSQL pool size, overflow, and timeout are configurable without changing defaults. | Measure Azure PostgreSQL connection capacity and load-test the replica/job budget. |
| TD-11 | Transactional quota and idempotency regression tests exist. | Add concurrent PostgreSQL tests for rate-bucket upserts, quota caps, and transaction rollback. |
| TD-12 | SSE tests cover chunked CRLF, unterminated final frames, and malformed JSON payloads. | Complete browser abort/disconnect/stop race tests and verify final-response UI behavior. |
| TD-13 | No raw-HTML plugin is configured in the known Markdown dependency set. | Finish a full renderer/link/image/chart audit and add explicit XSS regression tests. |
| TD-14 | Existing zero-minimum/two-maximum replica and single-revision settings are unchanged for cost safety. | Make scale/revision decisions only after measured latency/cost evidence. |
| TD-15 | Application release images use immutable registry digests. | Pin the database-access VM image to a validated version and document its update process. |
| TD-16 | Terraform validation and remote-state roots exist. | Record state ownership/locking/recovery procedure and verify least-privilege access in Azure. |
| TD-17 | Runtime-role provisioning now verifies no superuser/database-create/role-create privilege, no public-schema CREATE, and required table reads. | Execute the checks against the real database; review whether migration credentials can be narrower than the server administrator. |
| TD-18 | Upload handler enforces a byte limit, image format allowlist, pixel ceiling, re-encoding, and per-user storage/count limits. | Add concurrent upload/quota tests and verify proxy/ASGI limits remain aligned. |
| TD-19 | Existing browser coverage exercises branching, regeneration, stop, history, and export; no UI redesign was made. | Complete characterization coverage before any component/state refactor. |
| TD-20 | CI runs browser tests with deterministic fixtures. | Add multi-tab/concurrent-generation and scaled-replica coverage; keep real-provider tests opt-in. |
| TD-21 | Model environment variables that are no longer authoritative are documented in configuration comments. | Audit README/runbooks and verify all runtime configuration against deployment values. |
| TD-22 | Production deployment workflow is limited to main pushes or an explicit manual deploy; deploy runs smoke checks. | Verify branch protection/required checks/review rules in GitHub repository settings. |
| TD-23 | Request logs include route/status/duration; generation outcomes/duration and maintenance counts/failures are logged without prompt or secret content. | Add/verify provider latency/status, quota rejection, DB pool timeout, and retention-backlog alerting. |

**Do not interpret this evidence table as a 23/23 closure statement.** Some acceptance criteria depend on PostgreSQL concurrency, GitHub repository settings, measured query/load behavior, or a live Azure deployment. Those gates must be completed before the corresponding item is marked done.


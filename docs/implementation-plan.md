# YounderChat implementation plan

This document is the single source of truth for product goals, scope, delivery order, status and acceptance criteria. Repository READMEs provide setup instructions; Kiro steering provides coding rules.

## Goal and architecture

Build a professional ChatGPT-style app for the assignment using React, TypeScript and Material UI; Python FastAPI, SQLAlchemy and Alembic; and private PostgreSQL on Azure. Keep frontend, backend and infrastructure modular in one GitHub repository. Deploy a Docker image containing API and UI to Azure Container Apps through Terraform and GitHub Actions with OIDC, Key Vault and managed identities.

Azure resources must be managed through infrastructure code. GoDaddy DNS records were added manually with explicit user authorization. Preserve existing Azure resource names and the live subdomain. Keep the monthly INR 1,500 development target; Azure budget alerts are notifications, not a spending cap.

## Current status

As of 10 October 2026, `main` includes the original application/settings work plus follow-up fixes for authentication-session lifecycle, provider error handling, ChatGPT-style layout, and conversation-history continuity (PRs #15–#19). PR #19 is merged; its PR checks passed and the post-merge Application workflow completed successfully. That workflow result confirms CI only; it does not by itself prove that the latest revision is deployed or that live provider inference works. The public demo URL is https://aichat.sdigurukulam.in; verify its current release and provider health separately before submission claims. Local PostgreSQL uses port 25432.

Implemented application features include themes/contrast, cookie auth and RBAC, email verification/reset through Resend, single-session login and confirmation-based transfer, Basic/Pro/Pro Max plans, seat invitations, reserved-token usage records, audit events, retention, persistent conversations, streaming/stop/edit/regeneration, history/search/archive/delete/export and rich content. Settings has separate profile, appearance, plan/usage, data and security sections. Billing remains administrator-assigned; payment collection and invoices are not implemented. Images are display-only and stored in bounded PostgreSQL records.

Provider selection and adapters are implemented in `backend/app/services/provider.py`; that file is the source of truth for canonical model IDs, legacy aliases, plan eligibility, and provider dispatch. Keys are server-only and are provisioned through the documented local configuration or production secret path. Tests use explicitly labelled provider/email fixtures and do not establish real model availability. Admin MFA, scheduled user tasks, image generation, web search, document retrieval, and sandboxed code execution are not currently exposed as working features.

The repository currently has two GitHub Actions entrypoints: `Application` and `Infrastructure`. Treat workflow checks, a successful application release, and live production verification as separate pieces of evidence. Infrastructure changes must continue through Terraform and a reviewed plan; do not infer deployed cloud state from the source tree alone. Database operator access is an optional, cost/security-sensitive capability and should remain disabled until network scope, SSH key ownership, and incremental costs are explicitly reviewed.

## Architecture decisions and limits

- Same-origin sessions use host-only HttpOnly cookies, Secure in production, SameSite=Lax, absolute expiry and hashed opaque tokens. Mutations validate origins and session-bound CSRF. Argon2id protects passwords. Server ownership/role checks apply to every protected operation; access changes revoke sessions and are audited.
- PostgreSQL transactions and indexed ownership/order queries back users, sessions, conversations, message trees, usage, attachments and audit records. Stable ordinals preserve branches created within the same second. Message creation is idempotent per request ID. Conversation lists use cursors; conversations have a bounded 1,000-message tree. One response per conversation and at most two active responses per user and four app-wide are allowed. Individual branches are bounded to 200 messages.
- Generation creation reserves conservative UTF-8 byte/token overhead plus output allowance before provider calls. Defaults: 30 requests and 40,000 reserved tokens per user/day, 100,000 app-wide/day, 1,024 output tokens and a 120-second deadline. Reservations are not refunded on failure/stop. These controls complement budget alerts; pricing and infrastructure charges still need review.
- Gemini and Groq adapters normalize provider SSE into one async streaming interface. The chosen model is plan-authorized before usage is reserved and is persisted with the generated response and usage event. SSE separates start/delta/done/error. Partial responses are periodically saved; cancellation polls even silent upstreams. Interrupted leases expire into failure and can be regenerated. Rich-content rendering is memoized, workspace/charts are lazy, and server-state caching avoids unnecessary fetches.
- Private images are validated/re-encoded PNG/JPEG/WebP inputs under 2 MB and 16 megapixels, limited to 20 per user. Small assignment images are stored transactionally in PostgreSQL, a bounded tradeoff instead of adding Blob infrastructure before a demonstrated need. Images are display-only. Raw HTML and external Markdown image fetching are disabled. Numeric chart JSON is bounded; no model-generated code is executed.
- Production runtime receives only the runtime database secret. A separate migration identity receives migration credentials and applies schema/grants inside the VNet. The runtime role cannot create tables or read the raw Alembic version table; this branch grants SELECT on limited schema-status/history resources for the fixed operator job. Migration snapshots and the complete chain are tested; destructive downgrades are disabled.
- Initial admin provisioning uses a controlled operator command, never a public registration field. The new pipeline persists its command through Terraform instead of relying on Azure CLI overrides. Email verification/recovery use Resend with server-only credentials. Voice, web search, document retrieval, image generation and sandboxed execution are not exposed as working functionality.

For each release, verify the exact main commit, required CI jobs, migration/application workflow result, and the deployed app independently. Verify real model access before claiming working production AI chat. Keep setup instructions in READMEs and update this status section whenever a material release changes the implementation or remaining work.

## Ongoing engineering and release priorities

1. Release reliability: pass one immutable image digest to migrations and the application, validate workflow expressions, and run release smoke checks. CI success alone does not establish that the latest commit is deployed.
2. UI and architecture: preserve the shared MUI theme, accessible standard components, YounderChat wordmark, and existing responsive behavior. Split large components along feature boundaries when that reduces coupling; prefer existing MUI primitives over custom controls and avoid broad UI redesigns during refactors.
3. Authentication and RBAC: preserve CSRF/origin checks, login throttling, session expiry/revocation, ownership protection, hashed opaque sessions, Argon2id password verification, and secure HttpOnly host-only cookies. Keep admin provisioning controlled and verify the server-side authorization paths, not only whether controls are visible.
4. Provider verification: use `backend/app/services/provider.py` as the model-catalogue source of truth. Verify model IDs, provider credentials, quotas, and pricing against live provider APIs before release; a passing fixture test or configured key does not prove production inference.
5. Chat reliability and performance: retain persisted streaming states, cancellation/retry behavior, idempotent submissions, bounded context/history, and query-cache correctness. Debounce high-frequency search input, keep expensive rich-content/chart code lazy, and measure before adding caching or infrastructure.
6. Rich content and settings: preserve safe Markdown rendering, bounded chart data, copy/export, history search, message branches, and all settings sections. Images remain display-only unless an explicit model-understanding flow is implemented and tested.
7. Submission and operations: keep setup, architecture, configuration, limitations, screenshots, costs, and live-demo claims synchronized with the actual source and latest verified release. Separate CI evidence from live smoke-test evidence.

## Assignment coverage

Required: messaging, conversations, users and settings; REST APIs; React/state management/MUI theming; authentication and persistence; streaming; rich images/tables/lists; action buttons or choice menus.

Bonuses: caching, Docker, migrations, charts, syntax highlighting, dark mode, searchable/filterable history, copy, Markdown and export. Docker, versioned Alembic migrations, charts, syntax highlighting, theme modes, searchable history, copy, Markdown, and export are present in the repository. Treat these as implemented code paths, not automatically as proof of production behavior; use CI and live smoke checks for that. Add caching only for a measured need.

Submission: public repository, clear setup/configuration, architecture/design decisions, assumptions/limitations, screenshots or screen recording. Live deployment is optional in the PDF and required by the user's project goal. The PDF mentions a 48-hour assignment timeline; prioritize required features before advanced capabilities.

Voice, web search, image generation, document retrieval and sandboxed code execution are expanded product scope, not explicit PDF requirements. Schedule them after the required chat experience and verify provider capability and cost independently.

## Milestone acceptance criteria

| Milestone | Completion evidence |
| --- | --- |
| 1. Release | Workflow validation passes; committed fixes pass CI; staged release completes tests, image push, migrations, deployment and smoke checks using one immutable image digest. Verify the custom-domain frontend and database readiness after release. |
| 2. Design | Shared MUI tokens and YounderChat wordmark are used by the app shell; inspect desktop and mobile layouts with standard MUI icons. |
| 3. Appearance | Light/dark/system and standard/high contrast selections persist across reload; system mode follows OS changes; keyboard focus and contrast checks pass. Account preferences are synchronized through the existing authenticated profile API; continue checking persistence, keyboard focus, contrast, reduced motion, and mobile layouts. |
| 4. Auth/RBAC | Register/login/logout and profile work; expired/revoked sessions fail; cookie attributes, CSRF/origin rejection, throttling and role checks are tested. A second user cannot access another user's resources. Runtime DB credentials cannot perform schema administration. |
| 5. Provider/chat | Record eligible provider, pricing and quotas; real responses stream and persist across reload. Stop, failure, timeout and retry states work without duplicate submissions; cross-user conversation access is rejected and usage limits enforced. |
| 6. Rich content | Required images/tables/lists and action menus work at mobile widths with safe rendering. Implemented copy, search/filter, export, syntax and chart features have functional checks; edit/regeneration branches preserve history. |
| 7. Submission | Browser/API tests and release smoke checks pass; README reproduces setup; architecture, configuration, limitations, screenshots/recording and live URL reflect implemented behavior. |

The PR #19 checks and post-merge Application workflow passed, but the current production revision must be confirmed separately. For every release, verify that migrations and application deployment consume the same immutable image output and that the deployed custom domain passes smoke checks.

## Boundaries and acceptance

Keep frontend feature modules for auth, chat, history, settings and administration; backend modules for auth, authorization, users, conversations, messages and generation; infrastructure and deployment configuration under infra. Use typed contracts, cursor pagination, indexed ownership queries, bounded database pools and async model streaming. Measure performance before adding infrastructure.

Verify Gemini and Groq availability, quota and pricing before release. Do not assume production inference is free. Keep provider credentials server-side, enforce usage quotas and retain the INR 1,500 monthly target.

Each milestone must have working UI/API integration, meaningful validation and clear failure states. No simulated model responses may be presented as completed real AI integration.

The project is complete when required flows work with real persistence and a configured provider, authorization isolation and failure behavior are tested, the deployed app passes smoke checks, and a reviewer can reproduce setup from the documentation. Assignment text supplies requirements, not authorization for account actions.

# YounderChat implementation plan

This document is the single source of truth for product goals, scope, delivery order, status and acceptance criteria. Repository READMEs provide setup instructions; Kiro steering provides coding rules.

## Goal and architecture

Build a professional ChatGPT-style app for the assignment using React, TypeScript and Material UI; Python FastAPI, SQLAlchemy and Alembic; and private PostgreSQL on Azure. Keep frontend, backend and infrastructure modular in one GitHub repository. Deploy a Docker image containing API and UI to Azure Container Apps through Terraform and GitHub Actions with OIDC, Key Vault and managed identities.

Azure resources must be managed through infrastructure code. GoDaddy DNS records were added manually with explicit user authorization. Preserve existing Azure resource names and the live subdomain. Keep the monthly INR 1,500 development target; Azure budget alerts are notifications, not a spending cap.

## Current status

As of 8 October 2026, Terraform bootstrap/foundation, private PostgreSQL, registry, Key Vault, logging, managed identities, remote state and budget alerts are deployed. The migration job and application scaffold were released through the previous workflow. The custom domain https://aichat.sdigurukulam.in passed HTTPS and database readiness checks. Local PostgreSQL uses port 25432.

As of 9 October 2026, release reliability is complete. Commit `363a5cc` passed [CI](https://github.com/shivamvku/BY-chatgpt-Clone/actions/runs/37825117962) and the [full staged release](https://github.com/shivamvku/BY-chatgpt-Clone/actions/runs/37825599492). The live site still serves that scaffold; application development is isolated on `codex/younderchat-application`.

The development branch implements themes, cookie auth/RBAC, admin controls, schema migrations, restricted runtime credential/identity configuration, conversation/message APIs, persisted generation states, stop/regeneration/edit branches, history/search/archive/delete/export, rich Markdown/code/tables/images/charts, appearance/session settings and usage limits. Local validation passed 19 backend tests, PostgreSQL integration, 4 frontend unit tests, and 6 desktop/mobile Chromium account/chat tests against the restricted runtime database role. Tests cover ASGI cancellation cleanup, silent-upstream stop, provider failure, persistence, branching and exports. Lint, formatting, production builds, Terraform validation and 3 foundation policy tests also passed. Browser chat tests use a labelled fixture; they do not prove real Azure inference.

Application commit `f8a515e` passed [GitHub CI](https://github.com/shivamvku/BY-chatgpt-Clone/actions/runs/37873884840) and [browser integration](https://github.com/shivamvku/BY-chatgpt-Clone/actions/runs/37873884843). [Draft PR #3](https://github.com/shivamvku/BY-chatgpt-Clone/pull/3) contains the branch for review. A normal, fixture-free local Docker preview runs at http://localhost:8005 with a restricted database role and AI disabled. The public application rollout remains pending; local/CI success does not establish Azure auth/chat deployment.

Real Azure inference remains unverified: the subscription reports FreeTrial with its spending limit enabled, and the Central US usage API returns no quota entries. The model catalog lists gpt-4o-mini, but catalog presence alone is insufficient. `infra/config/ai.json` is disabled until subscription eligibility, quota and pricing are verified. The user selected Azure with strict usage limits. Email verification/reset, advanced tools and public application rollout remain pending.

## Architecture decisions and limits

- Same-origin sessions use host-only HttpOnly cookies, Secure in production, SameSite=Lax, absolute expiry and hashed opaque tokens. Mutations validate origins and session-bound CSRF. Argon2id protects passwords. Server ownership/role checks apply to every protected operation; access changes revoke sessions and are audited.
- PostgreSQL transactions and indexed ownership/order queries back users, sessions, conversations, message trees, usage, attachments and audit records. Stable ordinals preserve branches created within the same second. Message creation is idempotent per request ID. Conversation lists use cursors; conversations have a bounded 1,000-message tree. One response per conversation and at most two active responses per user and four app-wide are allowed. Individual branches are bounded to 200 messages.
- Generation creation reserves conservative UTF-8 byte/token overhead plus output allowance before provider calls. Defaults: 30 requests and 40,000 reserved tokens per user/day, 100,000 app-wide/day, 1,024 output tokens and a 120-second deadline. Reservations are not refunded on failure/stop. These controls complement budget alerts; pricing and infrastructure charges still need review.
- Async Azure v1 streaming uses managed identity in production and optional local development keys. SSE separates start/delta/done/error. Partial responses are periodically saved; cancellation polls even silent upstreams. Interrupted leases expire into failure and can be regenerated. Rich-content rendering is memoized, workspace/charts are lazy, and server-state caching avoids unnecessary fetches.
- Private images are validated/re-encoded PNG/JPEG/WebP inputs under 2 MB and 16 megapixels, limited to 20 per user. Small assignment images are stored transactionally in PostgreSQL, a bounded tradeoff instead of adding Blob infrastructure before a demonstrated need. Images are display-only. Raw HTML and external Markdown image fetching are disabled. Numeric chart JSON is bounded; no model-generated code is executed.
- Production runtime receives only the runtime database secret. A separate migration identity receives migration credentials and applies schema/grants inside the VNet. The runtime role cannot create tables or read migration metadata. Migration snapshots and the complete chain are tested; destructive downgrades are disabled.
- Initial admin provisioning uses an operator script, never a public registration field. Email verification/recovery remain unavailable until an email provider is integrated. Voice, web search, document retrieval, image generation and sandboxed execution are not exposed as working functionality.

Before public rollout: merge a validated branch, review/apply foundation identity/secret changes, run migrations and release, verify real model access and custom-domain auth/chat, and record evidence here. Setup instructions live in READMEs; do not create a competing status/review document.

## Delivery order

1. Release reliability: pass immutable image outputs to migrations and application, validate workflow expressions, then verify a full GitHub release. Local validation alone does not establish deployment success.
2. Design foundation: MUI theme tokens inspired by https://blueyonder.com/why-blue-yonder/ai-and-machine-learning/ai-agents, with blue primary actions, navy surfaces, clear typography and restrained accents. Use the YounderChat text wordmark and standard MUI icons. Preserve existing Azure resource names and the live subdomain.
3. Appearance settings: implement a small foundation for light, dark and system mode, plus an independent standard/high contrast selection. These are explicit user requirements; high contrast is not listed in the PDF. Persist preferences locally before login and synchronize user settings after authentication exists. Initialize before first paint; test keyboard focus, contrast, reduced motion and mobile layouts. Defer extensive visual polish until working chat.
4. Authentication and RBAC: deliver in small increments: schema and restricted runtime database access; secure session APIs and permission enforcement; then integrated account screens. Every publicly deployed auth increment must include applicable CSRF/origin checks, login throttling, session expiry/revocation and ownership protection. Use PostgreSQL users, hashed opaque sessions, Argon2id passwords and secure HttpOnly host-only cookies. Start with user/admin roles and a controlled admin provisioning script. Build admin management screens and email verification/reset separately after selecting an email provider; do not expose incomplete reset or verification flows.
5. Provider verification and chat vertical slice: first verify Azure subscription eligibility, model capabilities, streaming support, quotas and pricing; record the provider choice and configure per-user token/request limits before Terraform provisioning and real calls. Then implement conversation/message schema and REST APIs, a configurable model provider, persisted streaming generation states, cancellation and retry, and a responsive history/composer/message interface. Verify cross-user isolation and reload persistence before adding more controls.
6. Rich content and settings: safe Markdown, tables, lists, images, message action menus, syntax highlighting, copy, history search/filter, export, and validated chart data. Support prompt edits/regeneration through conversation branches. Document whether images are display-only or model-understood.
7. Production verification and submission: auth/chat browser tests, failure/cancellation tests, API contracts, full release smoke checks, cost/usage limits, architecture decisions, environment setup, screenshots or recording and the live demo URL.

## Assignment coverage

Required: messaging, conversations, users and settings; REST APIs; React/state management/MUI theming; authentication and persistence; streaming; rich images/tables/lists; action buttons or choice menus.

Bonuses: caching, Docker, migrations, charts, syntax highlighting, dark mode, searchable/filterable history, copy, Markdown and export. Docker and the migration mechanism exist; application schema revisions remain to be implemented. Add caching only for a measured need.

Submission: public repository, clear setup/configuration, architecture/design decisions, assumptions/limitations, screenshots or screen recording. Live deployment is optional in the PDF and required by the user's project goal. The PDF mentions a 48-hour assignment timeline; prioritize required features before advanced capabilities.

Voice, web search, image generation, document retrieval and sandboxed code execution are expanded product scope, not explicit PDF requirements. Schedule them after the required chat experience and verify provider capability and cost independently.

## Milestone acceptance criteria

| Milestone | Completion evidence |
| --- | --- |
| 1. Release | Workflow validation passes; committed fixes pass CI; staged release completes tests, image push, migrations, deployment and smoke checks using one immutable image digest. Verify the custom-domain frontend and database readiness after release. |
| 2. Design | Shared MUI tokens and YounderChat wordmark are used by the app shell; inspect desktop and mobile layouts with standard MUI icons. |
| 3. Appearance | Light/dark/system and standard/high contrast selections persist across reload; system mode follows OS changes; keyboard focus and contrast checks pass. Account synchronization is verified once auth is integrated. |
| 4. Auth/RBAC | Register/login/logout and profile work; expired/revoked sessions fail; cookie attributes, CSRF/origin rejection, throttling and role checks are tested. A second user cannot access another user's resources. Runtime DB credentials cannot perform schema administration. |
| 5. Provider/chat | Record eligible provider, pricing and quotas; real responses stream and persist across reload. Stop, failure, timeout and retry states work without duplicate submissions; cross-user conversation access is rejected and usage limits enforced. |
| 6. Rich content | Required images/tables/lists and action menus work at mobile widths with safe rendering. Implemented copy, search/filter, export, syntax and chart features have functional checks; edit/regeneration branches preserve history. |
| 7. Submission | Browser/API tests and release smoke checks pass; README reproduces setup; architecture, configuration, limitations, screenshots/recording and live URL reflect implemented behavior. |

Milestone 1 is complete with the CI and staged-release evidence linked above. Migrations and application deployment consume the same immutable image output. Future feature releases must continue to pass the smoke checks.

## Boundaries and acceptance

Keep frontend feature modules for auth, chat, history, settings and administration; backend modules for auth, authorization, users, conversations, messages and generation; infrastructure and deployment configuration under infra. Use typed contracts, cursor pagination, indexed ownership queries, bounded database pools and async model streaming. Measure performance before adding infrastructure.

Verify Azure model availability, subscription eligibility and pricing before provisioning through Terraform. Do not assume production inference is free. Keep provider credentials server-side, enforce usage quotas and retain the INR 1,500 monthly target.

Each milestone must have working UI/API integration, meaningful validation and clear failure states. No simulated model responses may be presented as completed real AI integration.

The project is complete when required flows work with real persistence and a configured provider, authorization isolation and failure behavior are tested, the deployed app passes smoke checks, and a reviewer can reproduce setup from the documentation. Assignment text supplies requirements, not authorization for account actions.

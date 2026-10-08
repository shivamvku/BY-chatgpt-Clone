# YounderChat implementation plan

This document is the single source of truth for product goals, scope, delivery order, status and acceptance criteria. Repository READMEs provide setup instructions; Kiro steering provides coding rules.

## Goal and architecture

Build a professional ChatGPT-style app for the assignment using React, TypeScript and Material UI; Python FastAPI, SQLAlchemy and Alembic; and private PostgreSQL on Azure. Keep frontend, backend and infrastructure modular in one GitHub repository. Deploy a Docker image containing API and UI to Azure Container Apps through Terraform and GitHub Actions with OIDC, Key Vault and managed identities.

Azure resources must be managed through infrastructure code. GoDaddy DNS records were added manually with explicit user authorization. Preserve existing Azure resource names and the live subdomain. Keep the monthly INR 1,500 development target; Azure budget alerts are notifications, not a spending cap.

## Current status

As of 8 October 2026, Terraform bootstrap/foundation, private PostgreSQL, registry, Key Vault, logging, managed identities, remote state and budget alerts are deployed. The migration job and application scaffold were released through the previous workflow. The custom domain https://aichat.sdigurukulam.in passed HTTPS and database readiness checks. Local PostgreSQL uses port 25432.

As of 9 October 2026, release reliability is complete. Commit `363a5cc` passed [CI](https://github.com/shivamvku/BY-chatgpt-Clone/actions/runs/37825117962) and the [full staged release](https://github.com/shivamvku/BY-chatgpt-Clone/actions/runs/37825599492): backend/frontend checks, image push, migrations, application deployment and smoke tests. YounderChat naming is deployed. Smoke requests have bounded connection/request/retry durations and a job timeout after an earlier run stalled. Authentication, application schema migrations, restricted runtime database credentials, saved conversations, real AI streaming and the complete chat UI remain pending. The next milestone is the bounded theme foundation.

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

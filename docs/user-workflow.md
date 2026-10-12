# End-to-End User Workflow

This guide describes the product flow and the main backend responsibilities. The exact visible controls can vary with the current UI, role, feature flags and configured integrations; use the frontend and API schemas as the final contract.

## 1. Application startup and deployment modes

### Local review mode
1. Install Python 3.12+, Node.js 22+ and npm.
2. Run `scripts/run-local.sh` or `scripts/run-local.ps1` from the repository root.
3. The launcher prepares the backend virtual environment and frontend dependencies, initializes a disposable SQLite database, seeds local demo accounts, then starts API and UI processes.
4. Open `http://localhost:5173`; API documentation is at `http://localhost:8000/api/docs`.
5. Local demo data is not production data. The seed routine is intended for SQLite only and must not be used against a shared or production database.

Local mode does not require Azure, Docker, email delivery, a production database or an LLM key to explore non-generation flows. Actual LLM responses require a valid server-side provider key.

### Deployed mode
The production delivery model described in the repository uses GitHub Actions, OIDC, Terraform, Azure Container Registry (ACR), Azure Container Apps (ACA), Azure Database for PostgreSQL and Key Vault/managed identity. Production migrations run before application rollout; smoke checks run after deployment. See [architecture](architecture.md) and [diagrams](diagrams/README.md).

## 2. Account and authentication journey

1. **Open the app.** The browser loads the React + TypeScript + Material UI application.
2. **Register or sign in.** The frontend submits credentials to the FastAPI REST API. Registration and sign-in behavior is defined by the auth routes and schemas.
3. **Create/validate session.** The server manages an opaque session token using an HttpOnly cookie. Session token material is hashed at rest; the browser should not read the HttpOnly cookie.
4. **Fetch session state.** The client calls `/api/auth/session` to establish the current user/session and obtain a session-bound CSRF token for mutating requests.
5. **Authorize each operation.** The API checks authentication, role/permission, request validation and resource ownership on the server. Hiding a button in the UI is not an authorization control.
6. **End or revoke a session.** Sign-out/session management revokes the relevant server-side session. Password/security flows may also invalidate sessions according to the implementation.

Authenticated mutations require an allowed `Origin` and `X-CSRF-Token` bound to the active server-side session. See [auth diagram](diagrams/auth-security.md).

## 3. Chat and generation journey

1. The user creates a conversation or opens an existing one.
2. The browser submits a message to the API. The backend validates the payload, authenticated identity, conversation ownership, request idempotency and usage/plan eligibility.
3. The server persists the user message and prepares a generation record. Usage reservation and generation state help prevent concurrent requests from exceeding limits.
4. The browser starts authenticated streaming with `POST /api/generations/{id}/stream`.
5. The generation service selects a provider/model through the provider abstraction and calls Gemini or Groq using server-side credentials.
6. Provider output is normalized to Server-Sent Events (SSE): `start`, `delta`, `done` or `error`. The UI appends deltas as they arrive.
7. Completion persists the assistant response and final usage/state. Provider failures, timeout, cancellation or client disconnects are represented explicitly; partial output may be persisted.
8. The user can stop generation, regenerate, edit/branch a message or continue with a follow-up. Retry requests should reuse request identifiers when the result of a prior submission is uncertain.

The exact behavior for retries, stop/disconnect races and usage settlement is implemented in backend services and tests. Do not infer billing semantics from UI labels alone. See [streaming diagram](diagrams/chat-streaming.md).

## 4. Conversation history

The user can work with their own conversations using the supported history operations:
- Browse history with cursor-based pagination.
- Search, rename, archive/unarchive and delete conversations.
- Export content as Markdown or JSON.
- Reopen a conversation and continue its message context.

The backend must verify ownership for each read or mutation. A conversation identifier is not proof of access. Message ordering is backed by persisted ordering fields; database migrations maintain the schema required for stable ordering.

## 5. Rich content and attachments

- Markdown is rendered in the chat view, including tables and code blocks with syntax highlighting.
- Supported chart content is rendered by the UI when returned in the expected format.
- Bounded image upload/display is implemented.
- Image understanding, web search, image generation, voice, document retrieval and sandboxed code execution are not established as working end-user capabilities in the documented scope. Do not promise these in a demo unless implementation and live validation have changed.

Treat provider output and uploaded content as untrusted input. Render through safe Markdown/content components and enforce server-side file size/type constraints.

## 6. Profile, appearance, plans and security settings

The application exposes profile and appearance settings, theme/contrast options, plan and usage information, and security/session controls. The exact fields and update endpoints are defined by the current frontend and backend schemas.

Plan administration is internal application functionality. Payment collection, payment-provider webhooks and invoice generation are not implemented; do not describe plan selection as a completed payment/subscription lifecycle.

## 7. Admin and account management

The controlled admin role has user/account management capabilities including user/plan administration, seat invitations, account/session controls and audit records. Admin APIs must enforce the role on the server and validate each target resource. Ordinary users must not be able to change their own privilege level by editing a request.

For interviews, explain the difference between:
- **Authentication:** proving which user/session is making a request.
- **Authorization:** checking whether that identity may perform the requested operation.
- **Ownership:** ensuring a user can access only their own conversations/messages unless an explicit admin capability applies.
- **Auditability:** recording security-sensitive administrative actions.

## 8. Persistence and data boundaries

| Environment | Application database | Intended use |
| --- | --- | --- |
| Local launcher | SQLite file at `backend/local.db` | Disposable reviewer/demo data |
| Deployed application | Azure Database for PostgreSQL, private network | Durable application data |

SQLAlchemy models and Alembic migrations define the schema. The release migration process uses a restricted runtime database role for application traffic rather than the migration/administrator connection. Schema history and release migration evidence are recorded by the migration process. Avoid destructive downgrade operations.

## 9. CI/CD and release journey

1. A pull request triggers automated validation.
2. CI runs frontend checks, backend lint/tests, browser tests and infrastructure/deployment validations configured in workflow files.
3. Browser tests use deterministic provider fixtures and an isolated PostgreSQL test database; they do not prove that a live LLM provider returned a real answer.
4. On the production workflow path, GitHub Actions obtains cloud identity through OIDC, builds/pushes an image, applies Terraform-managed infrastructure as configured, runs database migrations, deploys the application and runs smoke tests.
5. Review workflow conclusions and job logs, the deployed revision, migration outcome and health endpoint. A green CI result alone does not prove every external integration or every user journey works in production.

## 10. Troubleshooting guide

| Symptom | First checks |
| --- | --- |
| Login/session appears lost | Cookie settings, session endpoint, server-side session status, browser origin |
| Mutating API returns CSRF/origin error | Allowed origin, session-bound CSRF token, request headers and cookie inclusion |
| User sees another user's resource error | Confirm authenticated identity and ownership checks; do not weaken authorization |
| Generation cannot start | Provider configuration, plan/quota, generation state, server logs without secrets |
| Stream stops early | SSE event sequence, timeout/cancellation logs, provider response and persisted generation state |
| History is inconsistent | API pagination cursor, persisted ordering fields and current migration revision |
| Deployment health check fails | Workflow logs, image/revision, migration outcome, container startup and health endpoint |
| Browser test passes but live AI fails | Browser fixtures are deterministic; separately validate real provider credentials, model availability and quota |

## Related documents

- [System architecture](architecture.md)
- [Technical diagrams](diagrams/README.md)
- [Interview preparation](prep/README.md)
- [Backend README](../backend/README.md)

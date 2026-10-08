---
inclusion: fileMatch
fileMatchPattern: "backend/**/*"
---
# API standards

Keep FastAPI routes thin: validate requests with Pydantic, resolve identity/dependencies, call a service and return an explicit response schema. Services own business rules and transactions; keep database sessions scoped and reliably closed. Do not expose ORM objects or internal exception details directly.

Use consistent resource-oriented endpoints under `/api`, stable status codes and structured errors. Document contracts in OpenAPI. Bound message sizes, pagination and upload limits. Use UTC timestamps and explicit identifiers. Avoid blocking work inside async handlers; use supported async clients or FastAPI's synchronous execution model deliberately.

Authenticate protected operations and enforce conversation ownership on every read and mutation, including streaming and attachments. Do not trust user IDs sent by clients. Hash passwords with an appropriate password hashing library; keep tokens and signing secrets configurable. Select and document the auth/session strategy before implementing it; protect cookies and account for CSRF when cookies authenticate requests.

Persist users, conversations and messages through SQLAlchemy and versioned Alembic migrations. Use a restricted runtime database role before exposing authenticated chat publicly; the current scaffold's administrator connection is a temporary boundary. Make migrations backward compatible with the running revision and execute them through the migration job before releasing the new app.

Streaming must have a documented event contract, explicit completion/error behavior, cancellation and timeouts. Do not mark partial or failed model output as a successful completed response. Keep AI provider calls behind a service interface with bounded retries, usage limits and no credentials in frontend code. Tests may use a deterministic provider substitute; label demo substitutes clearly.

Validate attachment type and size, use generated storage names and enforce ownership. Do not fetch arbitrary user-provided URLs without protection against requests to internal services. Log request metadata and correlation IDs without tokens or message bodies.

Preserve `/api/health/live` and dependency-aware `/api/health/ready`. Production must not return the SPA for unknown API routes or missing assets. Test authorization isolation, transaction failures, streaming cancellation and readiness when these behaviors change.

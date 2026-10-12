# Architecture — Interview Q&A

## 1. Explain the application architecture end to end.

**Answer:** YounderChat uses a React/TypeScript/Material UI browser client and a FastAPI REST backend. The API authenticates requests, validates inputs, checks roles and resource ownership, and delegates use cases to backend services. SQLAlchemy persists users, sessions, conversations, messages, generation state and usage-related records. Chat generation is separated from HTTP routing and calls a provider abstraction for Gemini or Groq. The local launcher uses SQLite; the deployed design uses private Azure Database for PostgreSQL. GitHub Actions and Terraform support validation and Azure delivery.

**Follow-up:** Why separate routes from services? Routes stay focused on HTTP contracts; service-layer logic is easier to test and reuse.

## 2. Why React + TypeScript on the frontend?

**Answer:** React supports a component-based UI and stateful chat experience. TypeScript adds compile-time checking for props, API payloads and UI state. Material UI supplies consistent accessible primitives and theming. This does not remove the need for runtime API validation because network responses are untrusted.

**Follow-up:** What can still go wrong? Stale state, malformed server responses, race conditions in streams and rendering unsafe content.

## 3. Why FastAPI?

**Answer:** FastAPI provides typed request/response contracts, dependency injection patterns and generated OpenAPI documentation. It is a good fit for Python service code and async HTTP/streaming integration. Business rules remain in service modules rather than being spread across route handlers.

**Follow-up:** Does async automatically make everything faster? No; blocking SDK/database calls and CPU-heavy work still block execution unless handled appropriately.

## 4. Why use a provider abstraction?

**Answer:** It isolates provider-specific request formats, model IDs, response chunks and errors behind a normalized contract. The generation service can handle common lifecycle behavior while adapters translate to Gemini or Groq. It also keeps provider credentials on the server.

**Trade-off:** An abstraction adds interfaces and tests, and cannot make different models semantically identical. Provider capabilities, rate limits and token accounting still differ.

## 5. Why PostgreSQL in deployment and SQLite locally?

**Answer:** SQLite makes reviewer setup low-friction and requires no cloud account. PostgreSQL is a better fit for deployed concurrent application traffic, operational backups and managed database controls. Tests must cover the database behaviors that matter; local SQLite alone cannot prove PostgreSQL concurrency semantics.

## 6. Why use a separate generation service?

**Answer:** Generation is a long-lived lifecycle involving usage reservation, persisted states, provider streaming, cancellation, deadlines and partial results. Keeping it separate from the route layer improves testability and makes failure transitions explicit.

## 7. Why Azure Container Apps instead of managing VMs?

**Answer:** Container Apps provides a managed container runtime and reduces server administration for this application. ACR stores images; PostgreSQL provides managed persistence; Key Vault and managed identity support secret access; Terraform describes infrastructure. The trade-off is dependence on Azure platform behavior and configuration. Exact scale, ingress and SKU settings must be checked in Terraform.

## 8. What are the main trust boundaries?

**Answer:** Browser-to-API, API-to-database, API-to-provider, and CI-to-Azure. The browser is untrusted; authorization is server-side. Database access uses server-side credentials and a restricted runtime role. Provider keys stay server-side. CI uses OIDC/scoped Azure permissions where configured.

## 9. What would you change at much larger scale?

**Answer:** First measure latency, concurrency, DB pool pressure, provider throttling and queueing. Potential next steps include durable queue-based generation workers, distributed concurrency/usage coordination, per-tenant quotas, stronger observability, load testing and read/write database optimization. I would not introduce a queue or cache before the measured bottleneck justified the extra operational complexity.

## 10. How do you prove the architecture works?

**Answer:** Use layered evidence: unit tests for service rules, API integration tests for contracts and authorization, PostgreSQL integration tests for database-specific behavior, Playwright tests for critical browser flows, and deployment smoke checks for runtime health. Live provider calls and email delivery need separate integration checks because deterministic test fixtures do not prove those external services work.

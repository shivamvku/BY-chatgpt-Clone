# API Design — Interview Q&A

## 1. How do you design REST APIs?

**Answer:** Model resources and actions clearly, use predictable HTTP methods/status codes, validate request and response schemas, return consistent error shapes, document contracts through OpenAPI, and enforce authorization independently of routing. Keep route handlers thin and put business rules in services.

## 2. How is the current chat stream initiated?

**Answer:** The documented flow first creates/submits a message and receives a generation identifier, then the client calls authenticated `POST /api/generations/{id}/stream`. The stream emits normalized SSE events named `start`, `delta`, `done` and `error`. Confirm exact payload fields in current route schemas before describing them.

## 3. Why use POST for streaming instead of EventSource GET?

**Answer:** The application uses an authenticated POST stream after creating a generation. POST supports sending a request body and custom CSRF headers, while browser EventSource has more constrained request customization. Fetch-based streaming can consume a POST response, but reconnect/replay must be implemented explicitly if required.

## 4. How do you paginate conversation history?

**Answer:** Cursor pagination avoids large offset scans and is more stable as data changes. A cursor should encode a deterministic ordering key, and queries should use a matching index. The server must scope the query to the authenticated owner before applying the cursor. Treat cursors as opaque and validate them.

## 5. How do you handle duplicate submissions?

**Answer:** Use a stable request ID/idempotency key, scope it to the user and operation, and persist the result/state under a uniqueness constraint. If a retry arrives after an uncertain network outcome, return the existing generation or its current state rather than creating duplicate work.

## 6. What status codes would you use?

**Answer:** Typical choices: 200 for successful reads/updates, 201 for created resources, 202 for accepted asynchronous generation where the contract fits, 400 for malformed input, 401 for unauthenticated requests, 403 for authenticated but forbidden actions, 404 where a resource is missing or intentionally concealed, 409 for conflicting state/idempotency, 422 for schema validation, 429 for limits and 5xx for unexpected server/provider failures. Follow the application's existing error contract consistently.

## 7. How do you prevent insecure direct object references?

**Answer:** Never trust a conversation or generation ID by itself. Resolve the resource through the authenticated user or perform an explicit ownership check in the service for every read, write, stream and delete. Test cross-user access denial at API level, not only in the UI.

## 8. How should API errors be designed?

**Answer:** Return a stable machine-readable error code and a safe user-facing message, with request/correlation ID for support. Do not return stack traces, provider credentials, SQL errors, prompts containing sensitive data or internal infrastructure details. Log diagnostic context with secrets redacted.

## 9. How do you version APIs?

**Answer:** Prefer additive compatible changes where possible, use schemas to define contracts and tests to detect breaking changes. Introduce explicit versions only when compatibility needs justify it; document deprecation windows. Database migrations and frontend rollout must be compatible during the transition.

## 10. How do you test an API?

**Answer:** Unit-test service rules, integration-test routes with an isolated database, test invalid schema and auth/CSRF/ownership cases, exercise pagination boundaries and duplicate retries, and run browser tests for the critical full flow. Keep provider calls mocked/deterministic in ordinary CI; separately run safe live integration tests where credentials and quotas are available.

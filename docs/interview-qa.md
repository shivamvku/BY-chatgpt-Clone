# YounderChat — Interview Q&A Bank

Use this as a preparation guide for the Blue Yonder full-stack ChatGPT-clone discussion. Answers are intentionally concise; expand them with the relevant implementation details in the code during the interview.

> **Accuracy rule:** distinguish implemented behavior from architectural choices and future improvements. Do not claim a feature is production-ready unless you can demonstrate it in this repository or deployed environment.

## 1. Project overview

### Q1. Give me a 60-second overview of YounderChat.
YounderChat is a full-stack conversational AI application with a React and TypeScript UI and a FastAPI backend. The backend owns authentication, authorization, persistence, conversation APIs, and communication with configured LLM providers. The project includes automated checks and infrastructure-as-code for its Azure deployment. I focused on separating frontend, API, provider, and persistence responsibilities while making the application easy to run and review.

### Q2. Why did you choose a separate frontend and backend?
They have different responsibilities and release concerns. React manages interaction and presentation; FastAPI provides a typed API boundary, validates requests, enforces access control, and integrates with data stores and providers. This also lets the backend be tested independently and keeps provider credentials out of browser code.

### Q3. What are the main request flows?
The browser sends an authenticated request to the API. The API validates the input and the user's permissions, reads or writes the relevant application state, and invokes the configured model provider when generation is requested. The response is returned to the UI, which renders the assistant output and conversation state. Exact endpoints and response shapes should be confirmed against the current route and service implementations.

### Q4. What were the main engineering trade-offs?
The main trade-offs are simplicity versus operational resilience, a relational database versus additional infrastructure, and a provider abstraction versus provider-specific capabilities. I prefer a small number of well-defined components over adding infrastructure before scale or reliability requirements justify it.

## 2. System design and architecture

### Q5. How would you explain the architecture diagram?
The diagram separates the client, API/application services, persistence, external model providers, and delivery infrastructure. Browser requests go through the API; provider secrets remain server-side. The delivery path builds and publishes the application and deploys it to Azure using infrastructure-as-code and GitHub Actions identity federation.

### Q6. Why use FastAPI?
FastAPI provides request validation through typed models, OpenAPI documentation, async-compatible request handling, dependency injection, and a straightforward testing model. It suits a Python API that integrates with external model services.

### Q7. Why use a relational database?
Users, conversations, messages, and related ownership relationships are structured and need durable persistence and transactional updates. PostgreSQL is the production-oriented relational store. SQLite is provided for the local reviewer setup; it is not meant to reproduce every production database behavior.

### Q8. How would you scale the application?
First measure latency, throughput, error rates, provider latency, database connection usage, and resource consumption. Scale stateless API replicas horizontally, use connection pooling, add appropriate indexes, and introduce queues for work that should not block requests. Add caching only for data with clear consistency and invalidation rules. Any new service should solve an observed bottleneck rather than add complexity by default.

### Q9. What would you do if model responses became slow?
Measure provider latency separately from application latency. Set connection and request timeouts, expose clear progress or streaming feedback, handle provider rate limits, and record useful request IDs and sanitized error metrics. Depending on product requirements, consider queueing long jobs, retrying only transient failures with bounded backoff, and offering cancellation.

### Q10. How would you design for provider outages?
Keep provider integration behind a narrow service boundary, normalize errors, set timeouts, and avoid unbounded retries. A fallback provider is useful only if configured, tested, and compatible with the application's privacy and output requirements. Do not silently switch providers if doing so would violate user expectations or data policy.

### Q11. What are the main bottlenecks as usage grows?
External provider limits and latency, database connection capacity, large conversation histories, and concurrent streaming connections are likely candidates. Load tests and production metrics should determine the priority. Pagination, bounded context construction, pooling, and backpressure are possible mitigations.

### Q12. How would you make generation more reliable?
Use bounded timeouts, explicit generation states, cancellation handling, idempotency where duplicate requests are possible, and structured error reporting. If generation becomes asynchronous, persist job state and recover abandoned jobs rather than relying on one in-memory process.

## 3. API design

### Q13. What makes an API endpoint well-designed?
It should have a clear resource or action, typed input and output, consistent status codes, authentication and authorization, bounded input sizes, predictable error responses, and tests for success and failure paths. OpenAPI documentation should match actual behavior.

### Q14. How do you validate incoming requests?
Use Pydantic request models and explicit application-level checks for constraints that depend on business rules or database state. Validation errors should be actionable but must not reveal secrets or internal implementation details.

### Q15. How do you prevent a user from reading another user's conversation?
The server must verify ownership or an explicitly permitted role on every relevant read, update, and delete operation. Hiding a conversation in the UI is not authorization. Tests should attempt cross-user access and expect denial.

### Q16. How should API errors be handled?
Return consistent status codes and a stable error shape. Client errors should be distinguished from authentication failures, authorization failures, missing resources, rate limits, provider errors, and unexpected server failures. Log internal details server-side while returning safe messages to clients.

### Q17. How do you protect expensive generation endpoints?
Authenticate and authorize the caller, validate prompt and context sizes, apply request and concurrency limits, enforce provider timeouts, and monitor usage. If quota or billing enforcement is implemented, it should be enforced atomically on the server; a UI-only limit is not sufficient.

### Q18. How would you version the API?
Prefer backward-compatible additions where possible. If a breaking change is unavoidable, introduce a versioned route or negotiated contract, document the migration, and maintain tests for supported clients until the old contract is retired.

### Q19. How would you test the API?
Use unit tests for business logic, API tests for validation and authorization, database-backed tests for persistence and transactions, and integration tests for provider adapters using controlled fakes or fixtures. A fixture-based test proves application handling of that fixture; it does not prove that a live external provider is reachable.

## 4. Authentication and security

### Q20. Where should provider API keys live?
On the server, supplied through environment configuration or a managed secret store. They must not be embedded in frontend bundles, committed to source control, written to logs, or returned by API endpoints.

### Q21. How do you think about authentication versus authorization?
Authentication establishes who the caller is. Authorization determines what that caller may do. Both are required: a valid session alone does not grant access to every conversation or administrative operation.

### Q22. What security concerns are important for cookie-based sessions?
Cookie attributes such as HttpOnly, Secure in HTTPS environments, and an appropriate SameSite policy; CSRF protections where applicable; session expiration and revocation; and strict origin/CORS configuration. The exact protections should be described based on the current implementation, not assumed from the framework.

### Q23. What is the purpose of password hashing?
Passwords should never be stored in plaintext or reversibly encrypted for routine authentication. A modern password-hashing algorithm with appropriate parameters makes offline cracking more expensive if hashes are exposed. The algorithm and parameters should be verified in the current security module before naming them in an interview.

### Q24. How do you avoid leaking sensitive information in logs?
Log request IDs, timing, status, and sanitized diagnostic context. Avoid recording passwords, cookies, authorization headers, API keys, or complete private prompts by default. Apply retention and access controls to logs as well.

### Q25. What should be done before exposing a public demo?
Use dedicated demo credentials, remove real personal or production data, restrict administrative capabilities, keep provider secrets server-side, configure HTTPS and allowed origins, use safe rate limits, and confirm that the demo can be disabled or rotated. A public demo should not be treated as a production security audit.

## 5. LLM integration and streaming

### Q26. Why have a provider abstraction?
It isolates provider-specific SDKs, authentication, response formats, and errors from the rest of the application. This makes adapters easier to test and allows provider configuration to change without spreading provider-specific logic through the API and UI.

### Q27. How do you handle streaming output in the UI?
The UI consumes incremental response data, updates the visible assistant message, and handles completion and errors. It must avoid treating partial output as a completed persisted response and should clean up the stream when a user navigates away or cancels. Explain the exact transport and event format from the implemented code.

### Q28. What happens if a stream fails halfway through?
The application should stop the stream, display an understandable failure state, and preserve any partial output only if the product's persistence semantics explicitly support it. Retries need care because retrying generation may create a different answer or duplicate work.

### Q29. How do you manage conversation context?
Load the authorized conversation history, apply a bounded context policy, and send only the relevant messages to the provider. For longer histories, use truncation or a summarization strategy and account for token limits. Avoid sending unrelated users' data or hidden application secrets as context.

### Q30. How do you test LLM functionality without a paid provider call?
Use deterministic fake providers or recorded fixtures for normal CI. Add a separately controlled smoke test for live provider access if credentials and quotas are available. Clearly distinguish mocked integration coverage from live model verification.

### Q31. What is prompt injection, and how would you mitigate it?
Prompt injection is untrusted content attempting to override instructions or cause unintended tool/data access. Treat user and retrieved content as untrusted, enforce permissions in code rather than relying on prompts, constrain tool capabilities, validate tool inputs, and avoid exposing secrets in model context.

## 6. Frontend and UI

### Q32. How do you keep the UI maintainable?
Separate page-level composition from reusable components, keep API calls in a clear client/service layer, use typed request and response contracts, and keep state local unless it must be shared. Follow the existing design system and avoid introducing a second styling convention without a reason.

### Q33. How do you handle loading, empty, and error states?
Every asynchronous action should communicate its current state. Disable duplicate submissions when appropriate, show useful empty states, keep errors recoverable, and preserve the user's work when a request fails where possible.

### Q34. How do you avoid duplicate message submissions?
Guard the submit handler while a request is active, disable or otherwise gate the submit action, and consider a request identifier if the server operation needs idempotency. UI prevention is helpful, but the server should still be robust to retries.

### Q35. What accessibility considerations matter?
Keyboard navigation, visible focus, meaningful labels, semantic controls, readable contrast, screen-reader announcements for relevant status changes, and avoiding focus loss during streaming or modal interactions. Automated checks help, but keyboard and screen-reader review are still valuable.

### Q36. How would you improve frontend performance?
Profile before optimizing. Avoid unnecessary re-renders, paginate or virtualize very long histories if needed, split large bundles, optimize assets, and keep streaming updates efficient. Do not add memoization everywhere without evidence.

## 7. Azure, infrastructure, and CI/CD

### Q37. Why use Terraform?
Terraform makes infrastructure changes reviewable, repeatable, and version-controlled. State and credentials need protection, plans should be reviewed before apply, and modules should be kept understandable. Terraform does not replace operational monitoring or a rollback strategy.

### Q38. What is the role of GitHub Actions OIDC?
OIDC can let GitHub Actions obtain short-lived Azure credentials based on a trusted workflow identity, avoiding a long-lived client secret stored in GitHub. Trust conditions should be restricted to the intended repository, branch or environment, and workflow context.

### Q39. What do the Azure components do?
At a high level, Azure Container Registry stores built container images; Azure Container Apps runs containerized application workloads; Azure Database for PostgreSQL stores durable relational data; Key Vault stores secrets; managed identity allows supported Azure workloads to access resources without embedded credentials; and Terraform provisions infrastructure. Confirm each component against the current Terraform files and deployment configuration.

### Q40. What should a deployment pipeline do?
Install pinned dependencies, run lint and tests, build artifacts or images, scan or validate where configured, publish to a registry, and deploy only under the intended branch/environment conditions. Production deployment should depend on required checks and should not happen merely because a local command succeeded.

### Q41. How should database migrations be deployed?
Treat migrations as a controlled release step, run them with appropriate permissions, and avoid having every API replica race to apply schema changes on startup. Plan for backward-compatible schema changes when old and new application versions may overlap. The actual workflow should be checked before claiming a dedicated migration job exists.

### Q42. What is your rollback strategy?
Keep previous known-good image versions and deployment configuration, monitor post-deployment health, and restore the prior application revision if the release is unhealthy. Database changes need a separate compatibility plan; rolling back the container does not automatically reverse a destructive schema migration.

## 8. Local reviewer setup and demo

### Q43. Why offer a local SQLite setup?
It lets a reviewer run the UI and API without needing access to the production database or Azure subscription. The seeded accounts are disposable demo accounts. SQLite is for local review and is not intended to guarantee parity with PostgreSQL.

### Q44. Does the local app work without a provider API key?
The UI and API can be started locally, but real model generation depends on a configured provider key and available provider quota. Without a valid key, demonstrate the non-generation flows and be transparent about the limitation; do not imply live inference was verified.

### Q45. What is the public demo hostname?
The project README identifies `https://aichat.sdigurukulam.in/` as a personal GoDaddy DNS hostname configured for this interview. It is not a Blue Yonder-owned domain. Before a live demo, verify DNS, TLS, application health, and the current deployment state.

### Q46. How would you demo the application in five minutes?
1. Open the application and sign in with the documented local demo account or a prepared demo account.
2. Create a conversation and demonstrate the core chat interaction.
3. Show the relevant conversation/history or account flow.
4. Explain the browser-to-API-to-provider request path using the architecture diagram.
5. Show one API/test example and the CI pipeline.
6. Close by stating known limitations and what you would improve next.

## 9. Limitations and follow-up discussion

### Q47. Which features should you avoid overclaiming?
Do not claim payment collection, webhooks, or invoicing are implemented unless the code demonstrates them. Do not claim full image understanding, web search, image generation, retrieval, voice, scheduled tasks, or sandboxed code execution unless those capabilities are present and verified. Live model generation also depends on provider credentials, quota, and service availability.

### Q48. What would you improve with another week?
I would prioritize the highest-risk gaps based on the assignment rubric: end-to-end coverage of the primary user journey, stronger authorization and error-path tests, observability around provider calls and streaming, reproducible deployment checks, and clearer operational documentation. I would choose from measured risks rather than add infrastructure indiscriminately.

### Q49. How would you respond if an interviewer finds a bug during the demo?
Acknowledge it, reproduce it, explain the likely failure boundary, and distinguish a quick mitigation from a durable fix. Avoid claiming the system is flawless. If possible, show the relevant test or add a regression test after fixing the issue.

### Q50. What is the most important design principle in this project?
Keep trust boundaries explicit: the frontend is not trusted to enforce permissions, provider secrets remain server-side, persistence and authorization are handled by the backend, and deployment changes are reviewed and repeatable. Make limitations observable and be precise about what is implemented versus planned.

## Final preparation checklist

- [ ] Read the current route handlers, service layer, models, and security module before the interview.
- [ ] Be ready to point to the tests that prove authentication, ownership checks, and primary chat behavior.
- [ ] Verify the Linux and Windows local-run scripts on a clean checkout.
- [ ] Confirm which provider key environment variables the current code actually reads.
- [ ] Open the architecture diagram and describe the actual request path without guessing.
- [ ] Check the latest CI run and explain any failure honestly.
- [ ] Verify the demo URL and avoid using real user data.
- [ ] Be candid about features that are not implemented or not live-tested.

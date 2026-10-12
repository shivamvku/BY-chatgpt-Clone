# System Design — Interview Q&A

## 1. Design a ChatGPT-style application from scratch.

**Answer:** Start with a browser client, stateless API tier, relational persistence for users/conversations/messages, a generation orchestration service and provider adapters. Authentication and ownership checks protect every resource. For streaming, persist the generation state and stream normalized events. Add quotas and idempotency to control cost and retries. Deploy immutable containers through CI/CD and instrument latency, errors, provider usage and database health.

## 2. How would you scale concurrent generations?

**Answer:** Measure concurrent streams, provider latency, API worker utilization and database connection pressure first. Keep request handlers non-blocking where practical; cap per-user and global concurrency; apply bounded provider timeouts and backpressure. If long-running tasks outgrow API workers, move generation into durable workers behind a queue and store state so clients can reconnect. A queue adds delivery, lease and duplicate-processing complexity.

## 3. How would you make retries safe?

**Answer:** Give a client submission a stable idempotency/request ID. Persist the request identity and generation state, and enforce uniqueness at the appropriate scope. On retry, return or attach to the existing operation rather than creating a second billable generation. Handle the race where a request times out after the server commits but before the client receives the response.

## 4. How do you handle provider outages?

**Answer:** Bound connection/read timeouts, classify retryable versus permanent failures, use limited exponential backoff with jitter, and apply circuit-breaker or provider health policy when justified. Avoid blindly retrying a request that may already have generated tokens. If switching providers, record the actual provider/model used and consider context/format compatibility. Persist explicit failed/partial state.

## 5. How would you design usage limits?

**Answer:** Define the quota unit and reset window, reserve capacity before generation, then settle actual usage or release unused reservation on completion/failure. Make reservation and settlement idempotent and atomic enough to prevent concurrent requests from overspending. Enforce limits on the server; frontend counters are informational. Provider-reported token usage can be missing or different across providers, so define a fallback policy.

## 6. What database scaling issues do you anticipate?

**Answer:** Conversation history queries, message ordering, concurrent writes, indexes, connection pools and long transactions. Use cursor pagination, stable ordering, appropriate indexes and short transactions. Avoid holding a DB transaction open for the duration of an LLM stream. Archive or partition only when measurements justify it.

## 7. How would you support reconnecting to a stream?

**Answer:** Persist a generation ID and lifecycle state, and optionally sequence emitted events. On reconnect, authorize ownership, return current status and either replay retained events or let the client fetch the persisted result. Do not assume a browser SSE connection itself is durable. Replay requires a defined retention and event-ordering contract.

## 8. How would you protect against abuse and cost spikes?

**Answer:** Authenticate, enforce per-user/IP/account rate limits where appropriate, validate payload and upload sizes, cap prompt/context/output, restrict models by plan, cap concurrency, apply provider timeouts, and monitor spend and anomalous patterns. Rate limiting keyed only by client-supplied headers is unsafe unless trusted proxies are configured correctly.

## 9. How would you make deployment safe with schema changes?

**Answer:** Use expand-and-contract migrations: add compatible schema first, deploy code that can work with old/new forms, backfill if needed, then remove obsolete fields in a later release. Run migrations before app rollout, use a restricted runtime DB role, preserve immutable migration history, and verify health after deployment. Avoid assuming an automatic downgrade is always safe.

## 10. What metrics and alerts matter?

**Answer:** API p50/p95/p99 latency and error rate; active sessions; generation queue/wait and duration; time-to-first-token; stream cancellation; provider/model errors and throttling; input/output tokens and estimated cost; quota denials; DB pool saturation and query latency; container restarts; migration failures; deployment smoke checks. Avoid high-cardinality labels containing user IDs or prompt text.

## 11. Drawbacks of a monolith versus microservices?

**Answer:** A modular monolith is simpler to build, test, deploy and debug while traffic and team size are moderate. Separate generation workers or other services only when scaling, isolation or release cadence demands it. Microservices add network failures, observability, versioning and operational overhead.

## 12. Design exercise: 100,000 users, 5,000 concurrent chats.

**Answer outline:** Clarify peak concurrency, tokens/request, latency SLO and provider limits. Estimate active streams and DB writes; identify provider quota as a likely external bottleneck. Introduce bounded worker concurrency, durable generation state, distributed quota coordination, DB pooling/indexes, reconnect support and load tests. Capacity must be derived from measured model/provider limits and workload assumptions rather than invented fixed server sizes.

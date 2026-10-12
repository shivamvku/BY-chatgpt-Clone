# Chat and Generation — Interview Q&A

## 1. Explain one chat request end to end.

**Answer:** The browser submits a user message and request identifier. The API authenticates the session, checks ownership, validates the request and usage policy, and delegates to the generation service. The service persists the message/generation and reserves usage. The client then opens the generation stream; provider chunks are normalized into SSE events. The result and terminal state are persisted, and usage is settled.

## 2. Why persist the generation before streaming?

**Answer:** A durable ID/state lets the system track pending work, authorize later stop/status requests, handle client disconnects and reconcile failures. It also helps make retries idempotent. Avoid keeping the only copy of the request/result in an open HTTP connection.

## 3. What does SSE provide?

**Answer:** Server-Sent Events provide a one-way server-to-client event stream over HTTP, useful for token deltas and lifecycle events. The documented event names are `start`, `delta`, `done` and `error`. The client must parse frames correctly because network chunks do not align with event boundaries.

## 4. How does stop work?

**Answer:** The client requests cancellation for the active generation. The service transitions state, attempts to cancel upstream provider work where supported and records stopped/partial state. Races must be handled—for example, completion can arrive at the same time as stop. The final state should be consistent and idempotent.

## 5. How do you support regenerate and edit/branch?

**Answer:** Treat each generation as a distinct operation with a clear parent/context relationship. Regeneration should not overwrite the original response silently; edit/branch should preserve enough history to explain which context was used. Validate conversation ownership and ensure UI state tracks the active branch/generation.

## 6. How do you prevent two concurrent submissions from corrupting a conversation?

**Answer:** Use explicit generation IDs, request IDs, persisted statuses and well-defined concurrency rules. Enforce uniqueness or locking where necessary, keep transactions short, and prevent stale stream events from updating the wrong UI message. Test simultaneous submissions and stop/completion races.

## 7. What happens on a client disconnect?

**Answer:** The service detects disconnect or cancellation, attempts to cancel upstream work and applies a bounded timeout/lease strategy for abandoned operations. Persisted state is essential because a disconnect does not tell the client whether the provider completed. On revisit, fetch generation/conversation state.

## 8. How is history kept consistent?

**Answer:** Persist messages with deterministic ordering and use cursor-based pagination. Search/rename/archive/delete/export operations must enforce ownership. Ensure a new assistant message is associated with the intended conversation and generation.

## 9. What makes chat costly to operate?

**Answer:** Input context length, output tokens, provider/model pricing, retries, abandoned streams, parallel generations and abuse. Bound prompt/output, reserve quota, cap concurrency, record usage and monitor per-model latency/cost. Avoid logging full prompts as a substitute for observability.

## 10. How would you debug “the answer stopped halfway”?

**Answer:** Inspect the generation ID and persisted status, SSE event sequence, provider error/timeout, cancellation logs and usage settlement. Determine whether the backend received a provider terminal event, whether partial text was persisted, and whether the browser mishandled an event boundary. Reproduce with a deterministic test before testing a real provider.

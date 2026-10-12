# Chat Generation and Streaming Diagram

~~~mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as React Chat UI
  participant API as FastAPI
  participant Gen as Generation service
  participant DB as PostgreSQL / SQLite
  participant P as Provider abstraction
  participant LLM as Gemini or Groq
  User->>UI: Submit message
  UI->>API: Create/submit message + request ID
  API->>API: Authenticate, authorize ownership, validate payload and limits
  API->>Gen: Start generation use case
  Gen->>DB: Persist user message, generation and usage reservation
  DB-->>Gen: Generation ID / state
  Gen-->>API: Accepted generation
  API-->>UI: Generation ID
  UI->>API: POST /api/generations/{id}/stream + session/CSRF
  API->>Gen: Begin/attach stream
  Gen->>P: Select canonical model and adapter
  P->>LLM: Server-side request using provider key
  LLM-->>P: Provider chunks
  P-->>Gen: Normalized text / metadata
  Gen-->>API: start, delta, done or error
  API-->>UI: SSE event stream
  UI->>UI: Append deltas and update status
  Gen->>DB: Persist output and terminal state; settle usage
  User->>UI: Stop or navigate away (optional)
  UI->>API: Stop/cancel request
  API->>Gen: Request cancellation
  Gen->>LLM: Cancel upstream when supported
  Gen->>DB: Persist stopped/failed/partial result as appropriate
~~~

## Lifecycle and resilience

- SSE event names documented by the backend are `start`, `delta`, `done` and `error`.
- Persisted generation statuses include pending, streaming, complete, failed, stopping and stopped.
- Generation deadlines and abandoned leases are bounded; stop/disconnect cancellation is handled in the service.
- Reuse request IDs for uncertain client retries to reduce duplicate submissions.
- A stream can fail after partial output. Check persisted state and logs rather than assuming an HTTP connection finishing means successful completion.
- Browser test fixtures are deterministic and do not represent live LLM inference.

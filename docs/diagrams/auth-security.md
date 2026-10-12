# Authentication and Security Diagram

~~~mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as Browser UI
  participant API as FastAPI
  participant S as Session/Auth service
  participant DB as Database
  User->>UI: Submit registration or credentials
  UI->>API: Auth request over HTTPS
  API->>S: Validate credentials and account state
  S->>DB: Read user; persist session metadata
  DB-->>S: User/session result
  S-->>API: Session established
  API-->>UI: Set HttpOnly session cookie
  UI->>API: GET /api/auth/session
  API->>S: Validate session
  S->>DB: Resolve session and user
  DB-->>S: Session/user state
  S-->>API: Current identity + CSRF token
  API-->>UI: Session response
  User->>UI: Change data / create chat
  UI->>API: Mutation + cookie + Origin + X-CSRF-Token
  API->>S: Authenticate session
  S-->>API: Identity / session-bound CSRF context
  API->>API: Validate Origin, CSRF, role, ownership, payload
  API->>DB: Authorized operation only
  DB-->>API: Result
  API-->>UI: Response
  User->>UI: Sign out / revoke session
  UI->>API: Logout request
  API->>DB: Revoke server-side session
  API-->>UI: Clear cookie / logout result
~~~

## Security properties to explain

- Session tokens are opaque and hashed at rest; an HttpOnly cookie is not readable by ordinary browser JavaScript.
- CSRF protection is separate from authentication: mutating requests must include the allowed origin and the session-bound `X-CSRF-Token`.
- Authorization and ownership checks are performed server-side for conversations, messages, streaming, uploads and admin capabilities.
- Provider API keys are only used by backend adapters and are never sent to the browser.
- Password reset and email verification depend on the implemented service configuration and actual email delivery; a code path alone does not prove delivery is configured.
- Never log credentials, cookies, CSRF tokens, password reset tokens, provider keys or full sensitive payloads.

See [Backend README](../../backend/README.md) for additional implementation-specific notes.

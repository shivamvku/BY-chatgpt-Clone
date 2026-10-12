# End-to-End User Workflow Diagram

~~~mermaid
flowchart TD
  Start([Open app]) --> Mode{Environment?}
  Mode -->|Local| Launch[Launcher starts API and UI; SQLite initialized]
  Mode -->|Deployed| Runtime[Azure Container Apps runtime]
  Launch --> UI[Load React UI]
  Runtime --> UI
  UI --> Auth{Authenticated session?}
  Auth -->|No| Register[Register or sign in]
  Register --> Session[Server validates credentials and creates session]
  Session --> Cookie[HttpOnly session cookie + session-bound CSRF token]
  Cookie --> Authenticated[Load profile / settings / history]
  Auth -->|Yes| Authenticated
  Authenticated --> Action{User action}
  Action -->|Chat| Validate[Validate identity, ownership, request and plan/quota]
  Validate --> Persist[Persist user message and generation state]
  Persist --> Stream[POST generation stream; receive SSE events]
  Stream --> Save[Persist assistant result / final state / usage]
  Save --> Action
  Action -->|History| History[Paginate, search, rename, archive, delete or export]
  History --> Ownership[Server enforces ownership]
  Ownership --> Action
  Action -->|Settings| Settings[Profile, appearance, plan/usage, security]
  Settings --> Action
  Action -->|Admin role| Admin[Admin user/plan, invitation and session controls]
  Admin --> Audit[Record security-sensitive audit events]
  Audit --> Action
  Action -->|Sign out| Revoke[Revoke session and clear cookie]
  Revoke --> End([Signed out])
~~~

## Notes

- All authorization decisions are server-side.
- The UI may expose different controls depending on role and current implementation.
- Real model output requires a valid provider configuration; deterministic browser fixtures are for tests only.

# Logical Data Relationships

This is a conceptual diagram for interview discussion, not a literal ERD. Verify exact table names, nullable columns, uniqueness rules, indexes and foreign keys in SQLAlchemy models and Alembic migrations before treating it as a schema contract.

~~~mermaid
erDiagram
  USER ||--o{ SESSION : has
  USER ||--o{ CONVERSATION : owns
  CONVERSATION ||--o{ MESSAGE : contains
  USER ||--o{ GENERATION : requests
  CONVERSATION ||--o{ GENERATION : contextualizes
  GENERATION ||--o| USAGE_RECORD : accounts_for
  USER ||--o{ USAGE_RECORD : consumes
  USER ||--o{ AUDIT_RECORD : actor
  USER ||--o{ INVITATION : issues_or_receives

  USER {
    identifier id
    string email
    string role
    string account_status
  }
  SESSION {
    identifier id
    identifier user_id
    string token_hash
    datetime expires_at
    datetime revoked_at
  }
  CONVERSATION {
    identifier id
    identifier user_id
    string title
    datetime created_at
  }
  MESSAGE {
    identifier id
    identifier conversation_id
    string role
    text content
    datetime created_at
  }
  GENERATION {
    identifier id
    identifier user_id
    identifier conversation_id
    string status
    string request_id
  }
  USAGE_RECORD {
    identifier id
    identifier user_id
    identifier generation_id
    integer usage_units
  }
~~~

## Data integrity topics

- Enforce user/resource ownership in service logic and database constraints where appropriate.
- Use stable message ordering and cursor-based pagination for history.
- Use request IDs/idempotency handling for uncertain retries.
- Treat usage reservations and final usage settlement as a lifecycle, not just a frontend counter.
- Store session token hashes rather than raw session tokens.
- Keep schema changes in new Alembic revisions. Never rewrite a migration already deployed.
- The backend README documents the restricted runtime DB role, migration history and validation commands.

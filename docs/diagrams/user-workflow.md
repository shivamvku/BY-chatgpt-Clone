# User Workflow Architecture

This document details the complete user journey through YounderChat, from registration to AI-powered conversations, including all Azure service touchpoints and system interactions.

## User Journey Overview

The user workflow encompasses account management, authentication, conversation management, and AI interactions, all orchestrated through Azure Container Apps with secure backend services.

![YounderChat User Workflow](generated/user-workflow.png)

> *Generated diagram — run `python tools/generate_all_diagrams.py` to refresh*

## Detailed User Workflows

### Account Registration and Verification

*The main user workflow diagram above shows the complete registration process. Key steps include form validation, bcrypt password hashing, database storage via private network, and optional email verification when configured.*

### User Authentication Flow

*The comprehensive user workflow diagram shows the complete authentication process including Azure Key Vault integration for secure database connections and session management with HttpOnly cookies.*
        KV-->>API: Connection string
        API->>DB: SELECT user WHERE email = ?
        API->>API: Verify password (bcrypt)
        
        alt Valid credentials
            API->>DB: INSERT new session
            API->>API: Generate CSRF token
            API-->>App: Set HttpOnly cookie + CSRF
            App->>App: Update auth state
            App->>User: Redirect to dashboard
        else Invalid credentials
            API-->>App: Authentication error
            App->>User: Show error message
        end
    else Already authenticated
        App->>User: Access granted
    end
```

### Chat Conversation Flow

```mermaid
sequenceDiagram
    participant User as User Browser
    participant App as React Frontend
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    participant KV as Azure Key Vault
    participant AI as AI Provider

    User->>App: Navigate to chat
    App->>API: GET /api/conversations
    API->>DB: SELECT user conversations
    DB-->>API: Conversation list
    API-->>App: Paginated conversations
    App->>User: Display conversation history

    User->>App: Type message
    User->>App: Click Send
    
    App->>API: POST /api/conversations/{id}/messages
    Note over App,API: Include CSRF token
    
    API->>API: Validate session & ownership
    API->>DB: Check usage quotas
    API->>DB: INSERT user message
    API->>DB: UPDATE conversation timestamp
    
    API->>KV: Get AI provider key
    KV-->>API: API key
    API->>AI: Stream chat completion
    
    API->>DB: INSERT assistant message (streaming)
    
    loop Streaming response
        AI-->>API: Response chunk
        API->>API: Process chunk
        API-->>App: SSE event
        App->>User: Update UI incrementally
        API->>DB: UPDATE message content
    end
    
    AI-->>API: Stream complete
    API->>DB: UPDATE message (status: complete)
    API->>DB: INSERT usage event
    API-->>App: SSE: completion event
    App->>User: Final message display
```

### Settings and Profile Management

```mermaid
sequenceDiagram
    participant User as User Browser
    participant App as React Frontend
    participant API as FastAPI Backend
    participant DB as PostgreSQL

    User->>App: Navigate to /settings
    App->>API: GET /api/users/me
    API->>DB: SELECT user profile
    DB-->>API: User data
    API-->>App: Profile data (no password hash)
    App->>User: Display settings form

    User->>App: Update appearance theme
    App->>API: PATCH /api/users/me
    Note over App,API: CSRF protected
    API->>API: Validate session
    API->>DB: UPDATE user SET appearance = ?
    API-->>App: Updated profile
    App->>App: Update theme state
    App->>User: Apply new theme

    User->>App: Change password
    App->>API: POST /api/auth/change-password
    API->>API: Verify current password
    API->>API: Hash new password (bcrypt)
    API->>DB: UPDATE user password_hash
    API->>DB: DELETE all other sessions
    API-->>App: Password changed
    App->>User: Success notification
```

## Azure Service Integration Points

### Container Apps Integration

```mermaid
graph TB
    subgraph "Container App Environment"
        subgraph "Frontend Container"
            NGINX["Nginx<br/>Static file serving<br/>SPA routing"]
            ASSETS["React Build<br/>JS/CSS/Assets"]
        end
        
        subgraph "Backend Container"
            FASTAPI["FastAPI<br/>ASGI Server<br/>Uvicorn"]
            SERVICES["Business Logic<br/>Authentication<br/>AI Integration"]
        end
    end
    
    subgraph "Managed Identity Access"
        MI["Runtime Identity<br/>Container App MI"]
    end
    
    subgraph "Secret Resolution"
        KV["Key Vault<br/>Secret References"]
        ENV["Environment Variables<br/>@Microsoft.KeyVault(...)"]
    end
    
    subgraph "Database Access"
        PG["PostgreSQL<br/>Private Network<br/>SSL Required"]
    end
    
    NGINX --> FASTAPI
    FASTAPI --> SERVICES
    SERVICES --> MI
    MI --> KV
    KV --> ENV
    SERVICES --> PG
    
    %% Service endpoints
    NGINX -->|":443 HTTPS"| INGRESS["Public Ingress"]
    FASTAPI -->|":8000 Internal"| NGINX
```

### Data Flow Through Azure Services

```mermaid
graph LR
    subgraph "Client Layer"
        BROWSER["User Browser<br/>React SPA"]
    end
    
    subgraph "Edge Layer"
        CDN["Azure Front Door<br/>(Optional)"]
        DNS["Custom Domain<br/>aichat.sdigurukulam.in"]
    end
    
    subgraph "Application Layer"
        CA["Container App<br/>Public ingress<br/>HTTPS termination"]
    end
    
    subgraph "Data Layer"
        PG_RUNTIME["PostgreSQL<br/>chat_runtime user<br/>CRUD operations"]
        PG_PRIVATE["Private Subnet<br/>10.42.2.0/24"]
    end
    
    subgraph "Security Layer"
        MI["Managed Identity<br/>Credential-free access"]
        KV_RUNTIME["Key Vault<br/>runtime-database-url<br/>ai-provider-keys"]
    end
    
    subgraph "AI Layer"
        AI_PROVIDERS["External AI APIs<br/>Gemini/Groq<br/>Server-side keys"]
    end
    
    BROWSER --> DNS
    DNS --> CDN
    CDN --> CA
    CA --> PG_RUNTIME
    PG_RUNTIME --> PG_PRIVATE
    
    CA -.-> MI
    MI -.-> KV_RUNTIME
    CA --> AI_PROVIDERS
```

## User Experience States

### Application State Management

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Unauthenticated: No valid session
    Loading --> Authenticated: Valid session exists
    
    Unauthenticated --> Login: User navigates to login
    Unauthenticated --> Register: User navigates to register
    
    Login --> Authenticated: Successful login
    Login --> Unauthenticated: Login failed
    
    Register --> Unauthenticated: Registration complete
    Register --> Login: User has account
    
    Authenticated --> Dashboard: Default route
    Authenticated --> Chat: Chat interface
    Authenticated --> Settings: User preferences
    Authenticated --> Admin: Admin users only
    
    Dashboard --> NewChat: Create conversation
    Dashboard --> ExistingChat: Select conversation
    
    NewChat --> Chat: Conversation created
    ExistingChat --> Chat: Load conversation
    
    Chat --> Streaming: AI response in progress
    Streaming --> Chat: Response complete
    Streaming --> Error: Stream failed
    Error --> Chat: User retry
    
    Settings --> Authenticated: Settings saved
    Admin --> Authenticated: Admin actions complete
    
    Authenticated --> Unauthenticated: Logout/session expired
```

### Error Handling and Recovery

```mermaid
graph TB
    subgraph "Error Categories"
        AUTH_ERROR["Authentication Errors<br/>401 Unauthorized<br/>403 Forbidden"]
        NETWORK_ERROR["Network Errors<br/>Connection timeout<br/>Service unavailable"]
        QUOTA_ERROR["Usage Errors<br/>Daily limit exceeded<br/>Plan restrictions"]
        AI_ERROR["AI Provider Errors<br/>API key invalid<br/>Model unavailable"]
        SERVER_ERROR["Server Errors<br/>500 Internal error<br/>Database connection"]
    end
    
    subgraph "Recovery Actions"
        REDIRECT_LOGIN["Redirect to login<br/>Clear auth state"]
        RETRY_AUTO["Automatic retry<br/>Exponential backoff"]
        USER_RETRY["User-initiated retry<br/>Manual refresh"]
        UPGRADE_PROMPT["Plan upgrade prompt<br/>Contact admin"]
        ERROR_PAGE["Error page<br/>Support contact"]
    end
    
    AUTH_ERROR --> REDIRECT_LOGIN
    NETWORK_ERROR --> RETRY_AUTO
    NETWORK_ERROR --> USER_RETRY
    QUOTA_ERROR --> UPGRADE_PROMPT
    AI_ERROR --> USER_RETRY
    SERVER_ERROR --> ERROR_PAGE
    SERVER_ERROR --> RETRY_AUTO
```

## Performance and Scalability Patterns

### Frontend Performance

| Optimization | Implementation | Benefit |
|--------------|----------------|---------|
| **Code Splitting** | React.lazy() + Suspense | Smaller initial bundle |
| **Query Caching** | TanStack Query | Reduced API calls |
| **Virtual Scrolling** | Message list optimization | Handle large conversations |
| **Optimistic Updates** | UI updates before API confirmation | Perceived performance |
| **Progressive Loading** | Lazy load conversation history | Faster initial load |

### Backend Performance

| Optimization | Implementation | Benefit |
|--------------|----------------|---------|
| **Connection Pooling** | SQLAlchemy pool configuration | Efficient DB connections |
| **Query Optimization** | Indexed queries, pagination | Fast data retrieval |
| **Streaming Responses** | FastAPI StreamingResponse | Real-time AI output |
| **Rate Limiting** | Per-user request quotas | Fair resource usage |
| **Async Processing** | Python asyncio patterns | Non-blocking operations |

### Azure Integration Benefits

| Service | Performance Benefit | Scalability Feature |
|---------|---------------------|-------------------|
| **Container Apps** | Auto-scaling 0-2 replicas | Pay-per-use scaling |
| **PostgreSQL** | Burstable performance | Credit accumulation |
| **Key Vault** | Cached secret retrieval | High availability |
| **Log Analytics** | Centralized monitoring | Query-based insights |
| **Managed Identity** | Eliminated auth overhead | Automatic token refresh |

---

*Content was rephrased for compliance with licensing restrictions*

For complete system flow, see [System Architecture](../architecture.md)  
For data relationships, see [Data Model](data-model.md)  
For security details, see [Security Architecture](security-architecture.md)
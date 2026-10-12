# Security Architecture

This document details the security architecture of YounderChat, including identity management, access controls, secret management, and security boundaries within the Azure environment.

## Security Architecture Overview

YounderChat implements a comprehensive security model based on Azure managed identities, Key Vault secret management, role-based access control (RBAC), and network security boundaries.

```mermaid
graph TB
    subgraph "GitHub Identity"
        GITHUB["GitHub Actions"]
        OIDC["GitHub OIDC Provider"]
    end

    subgraph "Azure Active Directory"
        TENANT["Azure AD Tenant"]
        DEPLOY_MI["Deploy Identity<br/>Contributor + AcrPush + ContainerApp"]
        PLAN_MI["Plan Identity<br/>Reader + Key Vault Secrets User"]
        RUNTIME_MI["Runtime Identity<br/>AcrPull + Key Vault Secrets User"]
        MIGRATION_MI["Migration Identity<br/>Key Vault Secrets User"]
    end

    subgraph "Azure Key Vault - RBAC Enabled"
        subgraph "Secrets"
            DB_SECRET["database-url<br/>(Admin Connection)"]
            RUNTIME_DB["runtime-database-url<br/>(App Connection)"]
            OBSERVER_DB["observer-database-url<br/>(Read-only)"]
            GEMINI_KEY["gemini-api-key<br/>(Optional)"]
            GROQ_KEY["groq-api-key<br/>(Optional)"]
            RESEND_KEY["resend-api-key<br/>(Optional)"]
        end
        
        subgraph "Access Policies"
            RBAC_DEPLOY["Deploy: Key Vault Secrets Officer"]
            RBAC_PLAN["Plan: Key Vault Secrets User"]
            RBAC_RUNTIME["Runtime: Key Vault Secrets User<br/>(runtime-database-url only)"]
            RBAC_MIGRATION["Migration: Key Vault Secrets User"]
        end
    end

    subgraph "Container Platform"
        ACR["Container Registry<br/>Admin Disabled"]
        CA["Container App<br/>User-Assigned MI"]
        MIGRATION_JOB["Migration Job<br/>User-Assigned MI"]
    end

    subgraph "Database Layer"
        PG["PostgreSQL Flexible Server<br/>Private Network Only"]
        subgraph "Database Users"
            ADMIN_USER["chatadmin<br/>Full Access"]
            RUNTIME_USER["chat_runtime<br/>CRUD Operations"]
            OBSERVER_USER["chat_observer<br/>Read-Only"]
        end
    end

    subgraph "Application Layer"
        subgraph "Authentication"
            SESSION["Session Cookies<br/>HttpOnly + Secure"]
            CSRF["CSRF Tokens<br/>Session-bound"]
            PASSWORD["Password Hashing<br/>bcrypt"]
        end
        
        subgraph "Authorization"
            RBAC_APP["Role-Based Access<br/>admin/user"]
            OWNERSHIP["Resource Ownership<br/>user_id validation"]
        end
    end

    %% Identity flows
    GITHUB --> OIDC
    OIDC --> TENANT
    TENANT --> DEPLOY_MI
    TENANT --> PLAN_MI
    TENANT --> RUNTIME_MI
    TENANT --> MIGRATION_MI

    %% RBAC assignments
    DEPLOY_MI -.->|"Secrets Officer"| RBAC_DEPLOY
    PLAN_MI -.->|"Secrets User"| RBAC_PLAN
    RUNTIME_MI -.->|"Secrets User (Scoped)"| RBAC_RUNTIME
    MIGRATION_MI -.->|"Secrets User"| RBAC_MIGRATION

    %% Secret access flows
    RBAC_DEPLOY --> DB_SECRET
    RBAC_DEPLOY --> RUNTIME_DB
    RBAC_DEPLOY --> OBSERVER_DB
    RBAC_DEPLOY --> GEMINI_KEY
    RBAC_DEPLOY --> GROQ_KEY
    RBAC_DEPLOY --> RESEND_KEY
    
    RBAC_RUNTIME --> RUNTIME_DB
    RBAC_MIGRATION --> DB_SECRET
    RBAC_MIGRATION --> RUNTIME_DB

    %% Service access
    RUNTIME_MI -.->|"AcrPull"| ACR
    CA -.->|"Managed Identity"| RUNTIME_MI
    MIGRATION_JOB -.->|"Managed Identity"| MIGRATION_MI

    %% Database connections
    RUNTIME_DB -.->|"Connection String"| RUNTIME_USER
    DB_SECRET -.->|"Connection String"| ADMIN_USER
    OBSERVER_DB -.->|"Connection String"| OBSERVER_USER

    %% Application security
    CA --> SESSION
    CA --> CSRF
    CA --> PASSWORD
    CA --> RBAC_APP
    CA --> OWNERSHIP

    classDef identity fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef secret fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef security fill:#e8f5e8,stroke:#388e3c,stroke-width:2px

    class DEPLOY_MI,PLAN_MI,RUNTIME_MI,MIGRATION_MI identity
    class DB_SECRET,RUNTIME_DB,OBSERVER_DB,GEMINI_KEY,GROQ_KEY,RESEND_KEY secret
    class SESSION,CSRF,PASSWORD,RBAC_APP,OWNERSHIP security
```

## Identity and Access Management

### Managed Identity Configuration

| Identity | Type | Purpose | Scope |
|----------|------|---------|-------|
| **Deploy Identity** | User-assigned | CI/CD deployment operations | Subscription-level Contributor, ACR push, Container App management |
| **Plan Identity** | User-assigned | Terraform planning operations | Resource Group Reader, Key Vault Secrets User |
| **Runtime Identity** | User-assigned | Application runtime access | Scoped to specific secrets, ACR pull |
| **Migration Identity** | User-assigned | Database schema migrations | Database connection secrets only |

### Role-Based Access Control (RBAC)

```mermaid
graph LR
    subgraph "Azure Subscription"
        subgraph "Resource Group Level"
            DEPLOY_RG["Deploy Identity<br/>→ Contributor"]
            PLAN_RG["Plan Identity<br/>→ Reader"]
        end
        
        subgraph "Key Vault Level"
            DEPLOY_KV["Deploy Identity<br/>→ Secrets Officer"]
            PLAN_KV["Plan Identity<br/>→ Secrets User"]
            MIGRATION_KV["Migration Identity<br/>→ Secrets User"]
        end
        
        subgraph "Secret Level (Scoped)"
            RUNTIME_SECRET["Runtime Identity<br/>→ runtime-database-url only"]
        end
        
        subgraph "Container Registry"
            DEPLOY_ACR["Deploy Identity<br/>→ AcrPush"]
            RUNTIME_ACR["Runtime Identity<br/>→ AcrPull"]
        end
    end
```

### RBAC Assignments Details

| Principal | Resource | Role | Justification |
|-----------|----------|------|---------------|
| Deploy Identity | Resource Group | Contributor | Full deployment automation |
| Deploy Identity | Container Registry | AcrPush | Image publishing in CI/CD |
| Deploy Identity | Key Vault | Key Vault Secrets Officer | Manage deployment secrets |
| Plan Identity | Resource Group | Reader | Read resources for Terraform planning |
| Plan Identity | Key Vault | Key Vault Secrets User | Read secrets for planning |
| Runtime Identity | Container Registry | AcrPull | Pull application images |
| Runtime Identity | Key Vault (Scoped) | Key Vault Secrets User | Access runtime database connection only |
| Migration Identity | Key Vault | Key Vault Secrets User | Access database connections for migrations |

## Secret Management Architecture

### Key Vault Configuration
- **SKU**: Standard (cost-optimized for development)
- **Access Model**: RBAC-based (modern Azure security model)
- **Soft Delete**: 7-day retention (compliance and recovery)
- **Purge Protection**: Enabled (prevent permanent deletion)

### Secrets Inventory

| Secret Name | Purpose | Access Scope | Rotation |
|-------------|---------|--------------|----------|
| `database-url` | Admin database connection | Deploy, Migration identities | Manual |
| `runtime-database-url` | Application database connection | Runtime identity only | Manual |
| `observer-database-url` | Read-only database connection | Optional observer access | Manual |
| `gemini-api-key` | Google Gemini API access | Runtime identity (if configured) | Manual |
| `groq-api-key` | Groq API access | Runtime identity (if configured) | Manual |
| `resend-api-key` | Email service integration | Runtime identity (if enabled) | Manual |

### Secret Access Flow

```mermaid
sequenceDiagram
    participant CA as Container App
    participant MI as Runtime Identity
    participant KV as Key Vault
    participant PG as PostgreSQL

    Note over CA: Application Startup
    CA->>MI: Request managed identity token
    MI-->>CA: Azure AD access token
    
    CA->>KV: GET /secrets/runtime-database-url
    Note over CA,KV: Authorization: Bearer {token}
    KV->>KV: Validate token & RBAC
    KV-->>CA: Database connection string
    
    CA->>PG: Connect using connection string
    Note over CA,PG: SSL/TLS + Username/Password
    PG-->>CA: Connection established
```

## Application-Level Security

### Authentication Architecture

```mermaid
graph TD
    subgraph "User Authentication Flow"
        LOGIN["Login Request<br/>email + password"]
        HASH["Password Verification<br/>bcrypt comparison"]
        SESSION_CREATE["Session Creation<br/>Secure random token"]
        COOKIE["HttpOnly Secure Cookie<br/>SameSite=Strict"]
    end
    
    subgraph "Request Security"
        CSRF_TOKEN["CSRF Token<br/>Session-bound"]
        ORIGIN["Origin Validation<br/>ALLOWED_ORIGINS"]
        OWNERSHIP["Resource Ownership<br/>user_id validation"]
    end
    
    LOGIN --> HASH
    HASH --> SESSION_CREATE
    SESSION_CREATE --> COOKIE
    COOKIE --> CSRF_TOKEN
    CSRF_TOKEN --> ORIGIN
    ORIGIN --> OWNERSHIP
```

### Session Security Configuration

| Setting | Value | Security Benefit |
|---------|-------|------------------|
| **HttpOnly** | `true` | Prevents XSS access to session cookies |
| **Secure** | `true` | HTTPS-only cookie transmission |
| **SameSite** | `Strict` | CSRF protection |
| **Session Lifetime** | Configurable | Limits exposure window |
| **CSRF Token** | Session-bound | Prevents cross-site request forgery |

### Authorization Model

```mermaid
graph TB
    subgraph "Role-Based Authorization"
        USER_ROLE["User Role<br/>Basic chat access"]
        ADMIN_ROLE["Admin Role<br/>User management + chat"]
    end
    
    subgraph "Resource Ownership"
        CONV_OWNER["Conversation Ownership<br/>user_id validation"]
        MSG_OWNER["Message Ownership<br/>via conversation_id"]
        ATTACH_OWNER["Attachment Ownership<br/>user_id validation"]
    end
    
    subgraph "API Protection"
        RATE_LIMIT["Rate Limiting<br/>Per-user quotas"]
        PLAN_LIMIT["Plan Limits<br/>Daily requests/tokens"]
        INPUT_VALID["Input Validation<br/>Pydantic schemas"]
    end
    
    USER_ROLE --> CONV_OWNER
    ADMIN_ROLE --> CONV_OWNER
    CONV_OWNER --> MSG_OWNER
    USER_ROLE --> ATTACH_OWNER
    
    CONV_OWNER --> RATE_LIMIT
    RATE_LIMIT --> PLAN_LIMIT
    PLAN_LIMIT --> INPUT_VALID
```

## Database Security

### Connection Security

| Layer | Security Control | Implementation |
|-------|-----------------|----------------|
| **Network** | Private subnet only | No public IP, NSG protection |
| **Transport** | SSL/TLS encryption | Required for all connections |
| **Authentication** | Username/password | Strong generated passwords |
| **Authorization** | Database role separation | Least-privilege access |

### Database User Roles

```mermaid
graph TB
    subgraph "Database Users"
        ADMIN["chatadmin<br/>Full database access<br/>Schema migrations"]
        RUNTIME["chat_runtime<br/>CRUD operations<br/>Application access"]
        OBSERVER["chat_observer<br/>Read-only access<br/>Monitoring/analytics"]
    end
    
    subgraph "Permissions"
        DDL["DDL Operations<br/>CREATE, ALTER, DROP"]
        DML["DML Operations<br/>INSERT, UPDATE, DELETE"]
        SELECT["SELECT Operations<br/>Read access only"]
    end
    
    ADMIN --> DDL
    ADMIN --> DML
    ADMIN --> SELECT
    
    RUNTIME --> DML
    RUNTIME --> SELECT
    
    OBSERVER --> SELECT
```

### Database Connection Strings

| User | Purpose | Access Pattern | Secret Location |
|------|---------|----------------|-----------------|
| `chatadmin` | Migrations, admin operations | CI/CD only | `database-url` in Key Vault |
| `chat_runtime` | Application operations | Runtime only | `runtime-database-url` in Key Vault |
| `chat_observer` | Read-only monitoring | Optional | `observer-database-url` in Key Vault |

## Network Security Boundaries

### Security Zones

```mermaid
graph TB
    subgraph "Internet Zone"
        PUBLIC["Public Internet<br/>Untrusted"]
    end
    
    subgraph "DMZ Zone - Container Apps Subnet"
        CA["Container App<br/>Public ingress"]
        WAF["Application-level security<br/>Input validation, CSRF"]
    end
    
    subgraph "Private Zone - Database Subnet"
        PG["PostgreSQL<br/>Private access only"]
        NSG["Network Security Group<br/>Firewall rules"]
    end
    
    subgraph "Management Zone - Optional"
        VM["Database Access VM<br/>Authorized operators"]
    end
    
    PUBLIC -->|"HTTPS/443"| CA
    CA -->|"Private network<br/>TCP/5432"| PG
    VM -.->|"SSH tunnel<br/>TCP/5432"| PG
    
    NSG --> PG
    WAF --> CA
```

## Security Monitoring and Compliance

### Security Logging

| Event Type | Log Destination | Retention | Purpose |
|------------|-----------------|-----------|---------|
| **Authentication Events** | Application logs → Log Analytics | 30 days | Security auditing |
| **Authorization Failures** | Application logs → Log Analytics | 30 days | Access monitoring |
| **Key Vault Access** | Azure Monitor | 30 days | Secret access tracking |
| **NSG Flow Logs** | Optional configuration | Configurable | Network security monitoring |

### Compliance Features

| Control | Implementation | Compliance Benefit |
|---------|----------------|-------------------|
| **Data Encryption** | SSL/TLS, AES-256 | Data protection in transit/rest |
| **Identity Management** | Azure AD, Managed Identity | Centralized identity controls |
| **Access Logging** | Comprehensive audit trails | Accountability and monitoring |
| **Network Segmentation** | VNet, subnets, NSGs | Defense in depth |
| **Secret Management** | Key Vault, RBAC | Centralized secret lifecycle |

## Security Best Practices Implemented

### Azure Security Recommendations
- ✅ **Managed Identities**: No stored credentials in code
- ✅ **Key Vault Integration**: Centralized secret management
- ✅ **Private Networking**: Database isolated from internet
- ✅ **RBAC**: Principle of least privilege
- ✅ **SSL/TLS Everywhere**: Encrypted communications
- ✅ **Network Security Groups**: Firewall protection
- ✅ **Audit Logging**: Comprehensive security monitoring

### Application Security Measures
- ✅ **Password Hashing**: bcrypt with appropriate cost
- ✅ **Session Security**: HttpOnly, Secure, SameSite cookies
- ✅ **CSRF Protection**: Token-based validation
- ✅ **Input Validation**: Pydantic schema validation
- ✅ **Resource Ownership**: User-scoped access controls
- ✅ **Rate Limiting**: Abuse prevention
- ✅ **Plan Enforcement**: Usage quota controls

---

*Content was rephrased for compliance with licensing restrictions*

For network details, see [Network Topology](network-topology.md)  
For infrastructure overview, see [Azure Infrastructure](azure-infrastructure.md)  
For CI/CD security, see [CI/CD Pipeline](cicd-pipeline.md)
# Security Architecture

This document details the security architecture of YounderChat, including identity management, access controls, secret management, and security boundaries within the Azure environment.

## Security Architecture Overview

YounderChat implements a comprehensive security model based on Azure managed identities, Key Vault secret management, role-based access control (RBAC), and network security boundaries.

![YounderChat Security Architecture](generated/security-architecture.png)

> *Generated diagram — run `python tools/generate_all_diagrams.py` to refresh*

## Identity and Access Management

### Managed Identity Configuration

| Identity | Type | Purpose | Scope |
|----------|------|---------|-------|
| **Deploy Identity** | User-assigned | CI/CD deployment operations | Subscription-level Contributor, ACR push, Container App management |
| **Plan Identity** | User-assigned | Terraform planning operations | Resource Group Reader, Key Vault Secrets User |
| **Runtime Identity** | User-assigned | Application runtime access | Scoped to specific secrets, ACR pull |
| **Migration Identity** | User-assigned | Database schema migrations | Database connection secrets only |

### Role-Based Access Control (RBAC)

*The comprehensive security architecture diagram above shows the complete RBAC model. Key RBAC assignments:*

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

*The main security architecture diagram shows the complete secret access flow. The typical process:*

1. **Container App Startup**: App requests managed identity token from Azure AD
2. **Token Acquisition**: Azure AD validates the managed identity and issues access token
3. **Key Vault Access**: App uses token to request secrets from Key Vault (e.g., database connection string)
4. **RBAC Validation**: Key Vault validates token and checks RBAC permissions
5. **Secret Retrieval**: App receives the secret and establishes secure connections

## Application-Level Security

### Authentication Architecture

*The main security architecture diagram includes application-level security controls. Key authentication features:*

- **Session Cookies**: HttpOnly and Secure flags prevent XSS access
- **CSRF Tokens**: Session-bound tokens prevent cross-site request forgery  
- **Password Security**: bcrypt hashing with appropriate cost factor
- **Session Management**: Secure token generation and expiration handling

### Session Security Configuration

| Setting | Value | Security Benefit |
|---------|-------|------------------|
| **HttpOnly** | `true` | Prevents XSS access to session cookies |
| **Secure** | `true` | HTTPS-only cookie transmission |
| **SameSite** | `Strict` | CSRF protection |
| **Session Lifetime** | Configurable | Limits exposure window |
| **CSRF Token** | Session-bound | Prevents cross-site request forgery |

### Authorization Model

*The comprehensive security architecture shows the complete authorization model with role-based access and resource ownership validation:*

- **Role-Based Authorization**: Users have either 'user' or 'admin' roles
- **Resource Ownership**: All resources are scoped to the owning user_id
- **API Protection**: Rate limiting, plan limits, and input validation protect against abuse

## Database Security

### Connection Security

| Layer | Security Control | Implementation |
|-------|-----------------|----------------|
| **Network** | Private subnet only | No public IP, NSG protection |
| **Transport** | SSL/TLS encryption | Required for all connections |
| **Authentication** | Username/password | Strong generated passwords |
| **Authorization** | Database role separation | Least-privilege access |

### Database User Roles

*Database access follows the principle of least privilege with separate users for different purposes:*

- **chatadmin**: Full database access for schema migrations and administrative operations (DDL, DML, SELECT)
- **chat_runtime**: Application access with CRUD operations for normal application functionality (DML, SELECT) 
- **chat_observer**: Read-only access for monitoring, analytics, and reporting (SELECT only)

### Database Connection Strings

| User | Purpose | Access Pattern | Secret Location |
|------|---------|----------------|-----------------|
| `chatadmin` | Migrations, admin operations | CI/CD only | `database-url` in Key Vault |
| `chat_runtime` | Application operations | Runtime only | `runtime-database-url` in Key Vault |
| `chat_observer` | Read-only monitoring | Optional | `observer-database-url` in Key Vault |

## Network Security Boundaries

### Security Zones

*The main security architecture diagram illustrates the network security boundaries:*

- **Internet Zone**: Untrusted public internet traffic
- **DMZ Zone**: Container Apps subnet with public ingress and application-level security (input validation, CSRF)
- **Private Zone**: Database subnet with private access only, protected by Network Security Groups
- **Management Zone**: Optional database access VM for authorized operators (when enabled)

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
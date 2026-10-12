#!/usr/bin/env python3
"""
YounderChat Azure Architecture Diagram Generator

Professional diagram generation tool that creates Azure-style architecture diagrams
using the mingrammer/diagrams library with official Azure service icons.

This tool replaces all Mermaid diagrams with professional Azure documentation-style
visuals suitable for technical presentations and interviews.
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from diagrams import Diagram, Cluster, Edge
from diagrams.azure.compute import ContainerApps, ContainerRegistries, VM
from diagrams.azure.database import DatabaseForPostgresqlServers
from diagrams.azure.network import VirtualNetworks, Subnets, NetworkSecurityGroupsClassic as NetworkSecurityGroups, DNSPrivateZones, PublicIpAddresses
from diagrams.azure.security import KeyVaults
from diagrams.azure.identity import ManagedIdentities
from diagrams.azure.analytics import LogAnalyticsWorkspaces as LogAnalytics
from diagrams.azure.general import Resourcegroups, Subscriptions
from diagrams.azure.web import AppServices
from diagrams.onprem.client import Users
from diagrams.onprem.vcs import Github
from diagrams.generic.blank import Blank
from diagrams.programming.language import Python
from diagrams.saas import Saas


class AzureDiagramGenerator:
    """Generate professional Azure architecture diagrams for YounderChat application."""
    
    def __init__(self, output_dir: str = "docs/diagrams/generated"):
        """Initialize the diagram generator with output directory."""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # High-resolution 4K diagram configuration
        self.graph_attr = {
            "fontsize": "24",           # Larger font for better readability
            "fontname": "Arial Bold",   # Bold font for clarity
            "bgcolor": "white",
            "rankdir": "TB",
            "splines": "ortho",
            "nodesep": "2.0",          # More spacing between nodes
            "ranksep": "3.0",          # More spacing between ranks
            "dpi": "300",              # High DPI for crisp text
            "size": "20,16!",          # Large canvas size for 4K output
            "resolution": "300",        # High resolution
            "margin": "1.0"            # Better margins
        }
        
        self.node_attr = {
            "fontsize": "18",           # Larger node text
            "fontname": "Arial Bold",   # Bold font for nodes
            "style": "rounded,filled",
            "fillcolor": "lightblue",
            "color": "navy",
            "penwidth": "2",           # Thicker borders
            "margin": "0.3,0.2",       # Better text margins in nodes
            "width": "2.5",            # Wider nodes for better text space
            "height": "1.2"            # Taller nodes
        }
        
        self.edge_attr = {
            "fontsize": "14",           # Larger edge labels
            "fontname": "Arial",
            "color": "navy",
            "penwidth": "2",           # Thicker edges
            "arrowsize": "1.2"         # Larger arrows
        }

    def create_hd_diagram(self, title: str, filename: str, format: str = "png"):
        """Create a high-resolution diagram context with optimized settings."""
        return Diagram(
            title,
            filename=str(self.output_dir / filename),
            graph_attr=self.graph_attr,
            node_attr=self.node_attr,
            edge_attr=self.edge_attr,
            show=False,
            direction="TB",
            outformat=format            # Support both PNG and SVG
        )

    def generate_system_overview(self) -> str:
        """Generate system overview diagram replacing architecture.md mermaid."""
        filename = "system-overview"
        
        with self.create_hd_diagram("YounderChat System Architecture", filename):
            # User and external services
            with Cluster("Internet", graph_attr={"style": "dashed", "color": "gray"}):
                users = Users("Browser Users\n(HTTPS)")
                github = Github("GitHub Actions\n(CI/CD Pipeline)")
            
            # Azure environment
            with Cluster("Azure Subscription - Central US", graph_attr={"style": "rounded", "color": "blue"}):
                with Cluster("Resource Group", graph_attr={"style": "rounded", "color": "darkblue"}):
                    # Container platform
                    with Cluster("Container Platform", graph_attr={"style": "filled", "fillcolor": "lightcyan"}):
                        acr = ContainerRegistries("Container Registry\nStandard SKU\nAdmin Disabled")
                        container_env = ContainerApps("Container Environment\nConsumption Plan\nVNet Integrated")
                        container_app = ContainerApps("YounderChat App\n0.5 CPU, 1GB Memory\n0-2 Replicas")
                    
                    # Database layer
                    with Cluster("Database Layer", graph_attr={"style": "filled", "fillcolor": "lightyellow"}):
                        postgres = DatabaseForPostgresqlServers("PostgreSQL Flexible\nVersion 16\nB1ms, 32GB\nPrivate Network")
                    
                    # Security layer
                    with Cluster("Security & Identity", graph_attr={"style": "filled", "fillcolor": "lightgreen"}):
                        keyvault = KeyVaults("Key Vault\nRBAC Enabled\nManaged Identity\n7-day Soft Delete")
                        managed_id = ManagedIdentities("Runtime Identity\nUser-Assigned\nSecure Access")
                    
                    # Networking
                    with Cluster("Network Infrastructure", graph_attr={"style": "filled", "fillcolor": "lightsteelblue"}):
                        vnet = VirtualNetworks("Virtual Network\n10.42.0.0/16\nCentral US")
                        nsg = NetworkSecurityGroups("Security Groups\nFirewall Rules")
                    
                    # Monitoring
                    logs = LogAnalytics("Log Analytics\n30-day Retention\n1GB Daily Quota")
            
            # External AI providers
            with Cluster("AI Providers", graph_attr={"style": "dashed", "color": "orange"}):
                gemini = Saas("Google Gemini\nAI Generation")
                groq = Saas("Groq API\nAI Generation")
            
            # User flows with enhanced labels
            users >> Edge(label="HTTPS/443\nSecure Connection", color="green", style="bold") >> container_app
            container_app >> Edge(label="Private Network\nSSL/TLS Required", color="blue", style="bold") >> postgres
            
            # CI/CD flows
            github >> Edge(label="Build & Push\nContainer Images", color="purple") >> acr
            acr >> Edge(label="Image Pull\nManaged Identity", color="purple") >> container_app
            
            # Security flows
            managed_id >> Edge(label="Secret Access\nRBAC Permissions", style="dashed", color="red") >> keyvault
            container_app >> Edge(label="Managed Identity\nCredential-free", style="dashed", color="red") >> managed_id
            
            # AI integration
            container_app >> Edge(label="API Calls\nServer-side Keys", color="orange") >> gemini
            container_app >> Edge(label="API Calls\nServer-side Keys", color="orange") >> groq
            
            # Monitoring
            container_app >> Edge(label="Application Logs\nMetrics & Traces", color="gray") >> logs
            
            # Network relationships
            container_app - Edge(style="dotted", color="lightblue") - vnet
            postgres - Edge(style="dotted", color="lightblue") - vnet
            nsg - Edge(style="dotted", color="red") - postgres
        
        return filename

    def generate_azure_infrastructure(self) -> str:
        """Generate comprehensive Azure infrastructure diagram."""
        filename = "azure-infrastructure"
        
        with Diagram(
            "YounderChat Azure Infrastructure",
            filename=str(self.output_dir / filename),
            graph_attr=self.graph_attr,
            node_attr=self.node_attr,
            edge_attr=self.edge_attr,
            show=False,
            direction="TB"
        ):
            # Internet layer
            with Cluster("Internet"):
                users = Users("Users\nHTTPS Traffic")
                dns = Blank("GoDaddy DNS\naichat.sdigurukulam.in")
                github = Github("GitHub Actions\nCI/CD Pipeline")
            
            # Azure subscription
            with Cluster("Azure Subscription - Central US"):
                subscription = Subscriptions("Subscription")
                
                with Cluster("Resource Group"):
                    rg = Resourcegroups("Resource Group")
                    
                    # Virtual network with subnets
                    with Cluster("Virtual Network - 10.42.0.0/16"):
                        vnet = VirtualNetworks("VNet")
                        
                        with Cluster("Container Apps Subnet - 10.42.0.0/23"):
                            container_env = ContainerApps("Container Environment\nConsumption Profile")
                            container_app = ContainerApps("Container App\n0.5 CPU, 1Gi, 0-2 Replicas")
                        
                        with Cluster("Database Subnet - 10.42.2.0/24"):
                            postgres = DatabaseForPostgresqlServers("PostgreSQL Flexible\nv16, B1ms, 32GB\nPrivate Only")
                    
                    # Security and identity services
                    with Cluster("Security & Identity"):
                        keyvault = KeyVaults("Key Vault\nStandard, RBAC\n7-day Soft Delete")
                        runtime_id = ManagedIdentities("Runtime Identity")
                        migration_id = ManagedIdentities("Migration Identity")
                    
                    # Container services
                    with Cluster("Container Services"):
                        acr = ContainerRegistries("Container Registry\nStandard SKU\nAdmin Disabled")
                    
                    # Monitoring services
                    with Cluster("Monitoring"):
                        logs = LogAnalytics("Log Analytics\nPerGB2018, 30-day\n1GB Daily Quota")
                    
                    # Network security
                    with Cluster("Network Security"):
                        nsg = NetworkSecurityGroups("Network Security Group\nDatabase Protection")
                        private_dns = DNSPrivateZones("Private DNS Zone\n*.postgres.database.azure.com")
            
            # External providers
            with Cluster("External Providers"):
                gemini = Saas("Google Gemini API")
                groq = Saas("Groq API")
            
            # Connection flows
            users >> dns >> container_app
            container_app >> Edge(label="Private/5432") >> postgres
            
            # CI/CD flows
            github >> acr >> container_app
            
            # Security flows
            container_app >> Edge(style="dashed", label="Managed Identity") >> keyvault
            runtime_id >> Edge(style="dashed", label="RBAC") >> keyvault
            runtime_id >> Edge(style="dashed", label="AcrPull") >> acr
            
            # AI provider flows
            container_app >> Edge(label="Server-side Keys") >> gemini
            container_app >> Edge(label="Server-side Keys") >> groq
            
            # Monitoring flows
            container_app >> logs
            container_env >> logs
            
            # Network security
            nsg >> postgres
            private_dns >> postgres
        
        return filename

    def generate_network_topology(self) -> str:
        """Generate network topology diagram with VNet, subnets, and security groups."""
        filename = "network-topology"
        
        with Diagram(
            "YounderChat Network Topology",
            filename=str(self.output_dir / filename),
            graph_attr=self.graph_attr,
            node_attr=self.node_attr,
            edge_attr=self.edge_attr,
            show=False,
            direction="TB"
        ):
            # Internet
            with Cluster("Internet"):
                client = Users("Client Browsers")
                github = Github("GitHub Actions")
            
            # Azure Virtual Network
            with Cluster("Azure Virtual Network - 10.42.0.0/16"):
                vnet = VirtualNetworks("Virtual Network")
                
                # Container Apps Subnet
                with Cluster("Container Apps Subnet - 10.42.0.0/23"):
                    container_env = ContainerApps("Container Environment")
                    container_app = ContainerApps("Container App\nPublic Ingress:8000")
                
                # Database Subnet
                with Cluster("Database Subnet - 10.42.2.0/24"):
                    postgres = DatabaseForPostgresqlServers("PostgreSQL Server\nPrivate:5432")
                    nsg_db = NetworkSecurityGroups("DB Security Group")
                
                # Optional Management Subnet
                with Cluster("Management Subnet - 10.42.3.0/24 (Optional)"):
                    mgmt_vm = VM("Database Access VM\nSSH Tunnel")
                
                # Private DNS
                private_dns = DNSPrivateZones("Private DNS Zone\n*.postgres.database.azure.com")
            
            # External services
            with Cluster("External Azure Services"):
                acr = ContainerRegistries("Container Registry")
                keyvault = KeyVaults("Key Vault")
                logs = LogAnalytics("Log Analytics")
            
            # Traffic flows with protocols
            client >> Edge(label="HTTPS/443") >> container_app
            container_app >> Edge(label="Private/5432\nSSL Required") >> postgres
            container_app >> Edge(label="HTTPS/443\nManaged Identity", style="dashed") >> keyvault
            container_app >> Edge(label="HTTPS/443\nManaged Identity", style="dashed") >> acr
            container_app >> Edge(label="HTTPS/443\nLogs & Metrics") >> logs
            
            # CI/CD flows
            github >> Edge(label="HTTPS/443\nOIDC Auth") >> acr
            github >> Edge(label="Azure CLI\nContainer Update", style="dashed") >> container_app
            
            # Management access (optional)
            mgmt_vm >> Edge(label="TCP/5432\nSSH Tunnel", style="dashed") >> postgres
            
            # Network security associations
            nsg_db >> postgres
            private_dns >> Edge(label="Private Resolution", style="dashed") >> postgres
        
        return filename

    def generate_security_architecture(self) -> str:
        """Generate security architecture diagram with identities, RBAC, and Key Vault."""
        filename = "security-architecture"
        
        with Diagram(
            "YounderChat Security Architecture",
            filename=str(self.output_dir / filename),
            graph_attr=self.graph_attr,
            node_attr=self.node_attr,
            edge_attr=self.edge_attr,
            show=False,
            direction="TB"
        ):
            # GitHub Identity
            with Cluster("GitHub Identity"):
                github = Github("GitHub Actions")
                oidc = Blank("GitHub OIDC Provider")
            
            # Azure AD
            with Cluster("Azure Active Directory"):
                tenant = Blank("Azure AD Tenant")
                deploy_mi = ManagedIdentities("Deploy Identity\nContributor + AcrPush")
                plan_mi = ManagedIdentities("Plan Identity\nReader + KV User")
                runtime_mi = ManagedIdentities("Runtime Identity\nAcrPull + KV User")
                migration_mi = ManagedIdentities("Migration Identity\nKV User")
            
            # Key Vault with secrets
            with Cluster("Azure Key Vault - RBAC Enabled"):
                keyvault = KeyVaults("Key Vault\nStandard SKU")
                
                with Cluster("Secrets"):
                    db_secret = Blank("database-url")
                    runtime_db = Blank("runtime-database-url")
                    observer_db = Blank("observer-database-url")
                    gemini_key = Blank("gemini-api-key")
                    groq_key = Blank("groq-api-key")
                    resend_key = Blank("resend-api-key")
                
                with Cluster("Access Policies"):
                    rbac_deploy = Blank("Deploy: Secrets Officer")
                    rbac_plan = Blank("Plan: Secrets User")
                    rbac_runtime = Blank("Runtime: Secrets User\n(Scoped)")
                    rbac_migration = Blank("Migration: Secrets User")
            
            # Container Platform
            with Cluster("Container Platform"):
                acr = ContainerRegistries("Container Registry\nAdmin Disabled")
                container_app = ContainerApps("Container App\nUser-Assigned MI")
                migration_job = ContainerApps("Migration Job\nUser-Assigned MI")
            
            # Database Layer
            with Cluster("Database Layer"):
                postgres = DatabaseForPostgresqlServers("PostgreSQL Server\nPrivate Network")
                
                with Cluster("Database Users"):
                    admin_user = Blank("chatadmin\nFull Access")
                    runtime_user = Blank("chat_runtime\nCRUD Operations")
                    observer_user = Blank("chat_observer\nRead-Only")
            
            # Application Security
            with Cluster("Application Layer"):
                with Cluster("Authentication"):
                    session = Blank("Session Cookies\nHttpOnly + Secure")
                    csrf = Blank("CSRF Tokens\nSession-bound")
                    password = Blank("Password Hashing\nbcrypt")
                
                with Cluster("Authorization"):
                    rbac_app = Blank("Role-Based Access\nadmin/user")
                    ownership = Blank("Resource Ownership\nuser_id validation")
            
            # Identity flows
            github >> oidc >> tenant
            tenant >> deploy_mi
            tenant >> plan_mi
            tenant >> runtime_mi
            tenant >> migration_mi
            
            # RBAC assignments
            deploy_mi >> Edge(style="dashed", label="Secrets Officer") >> rbac_deploy
            plan_mi >> Edge(style="dashed", label="Secrets User") >> rbac_plan
            runtime_mi >> Edge(style="dashed", label="Secrets User") >> rbac_runtime
            migration_mi >> Edge(style="dashed", label="Secrets User") >> rbac_migration
            
            # Secret access flows
            rbac_deploy >> db_secret
            rbac_deploy >> runtime_db
            rbac_runtime >> runtime_db
            rbac_migration >> db_secret
            
            # Service access
            runtime_mi >> Edge(style="dashed", label="AcrPull") >> acr
            container_app >> Edge(style="dashed", label="Managed Identity") >> runtime_mi
            migration_job >> Edge(style="dashed", label="Managed Identity") >> migration_mi
            
            # Database connections
            runtime_db >> Edge(style="dashed", label="Connection String") >> runtime_user
            db_secret >> Edge(style="dashed", label="Connection String") >> admin_user
            observer_db >> Edge(style="dashed", label="Connection String") >> observer_user
            
            # Application security
            container_app >> session
            container_app >> csrf
            container_app >> password
            container_app >> rbac_app
            container_app >> ownership
        
        return filename

    def generate_cicd_pipeline(self) -> str:
        """Generate CI/CD pipeline diagram with GitHub Actions to Azure deployment."""
        filename = "cicd-pipeline"
        
        with Diagram(
            "YounderChat CI/CD Pipeline",
            filename=str(self.output_dir / filename),
            graph_attr=self.graph_attr,
            node_attr=self.node_attr,
            edge_attr=self.edge_attr,
            show=False,
            direction="TB"
        ):
            # Development
            with Cluster("Development"):
                dev = Users("Developer")
                pr = Github("Pull Request")
            
            # GitHub Actions
            with Cluster("GitHub Actions"):
                actions = Github("GitHub Workflows")
                
                with Cluster("Validation Steps"):
                    frontend = Blank("Frontend\nLint, Test, Build")
                    backend = Blank("Backend\nLint, Test")
                    browser = Blank("Browser Tests\nPlaywright")
                    infra = Blank("Infrastructure\nTerraform Validate")
                
                gate = Blank("Quality Gate")
                
                with Cluster("Deployment Steps"):
                    oidc = Blank("GitHub OIDC\nFederation")
                    identity = ManagedIdentities("Scoped Azure Identity")
                    image_build = Blank("Build Container\nImage")
                    tf_deploy = Blank("Terraform\nPlan/Apply")
                    migration = Blank("Database\nMigrations")
                    app_deploy = Blank("Deploy Application\nRevision")
                    smoke = Blank("Health & Smoke\nChecks")
            
            # Azure Services
            with Cluster("Azure Deployment"):
                acr = ContainerRegistries("Container Registry")
                container_app = ContainerApps("Container Apps")
                postgres = DatabaseForPostgresqlServers("PostgreSQL")
                keyvault = KeyVaults("Key Vault")
            
            # Development flow
            dev >> pr >> actions
            
            # Validation flow
            actions >> frontend
            actions >> backend
            actions >> browser
            actions >> infra
            frontend >> gate
            backend >> gate
            browser >> gate
            infra >> gate
            
            # Deployment flow
            gate >> Edge(label="All checks pass") >> oidc
            oidc >> identity
            actions >> image_build >> acr
            actions >> tf_deploy >> container_app
            tf_deploy >> postgres
            identity >> keyvault
            acr >> container_app
            actions >> migration >> postgres
            migration >> app_deploy >> container_app
            app_deploy >> smoke
            smoke >> Edge(label="Success", color="green") >> Blank("Release Complete")
            smoke >> Edge(label="Failed", color="red") >> Blank("Alert & Rollback")
        
        return filename

    def generate_data_model(self) -> str:
        """Generate data model diagram with PostgreSQL relationships."""
        filename = "data-model"
        
        with Diagram(
            "YounderChat Data Model",
            filename=str(self.output_dir / filename),
            graph_attr=self.graph_attr,
            node_attr=self.node_attr,
            edge_attr=self.edge_attr,
            show=False,
            direction="TB"
        ):
            # Database server
            with Cluster("PostgreSQL Flexible Server"):
                postgres = DatabaseForPostgresqlServers("PostgreSQL v16\nB1ms, 32GB")
                
                with Cluster("Core Entities"):
                    users = Blank("users\nid, email, password_hash\ncreated_at, updated_at")
                    sessions = Blank("sessions\nid, user_id, token\nexpires_at, created_at")
                    
                with Cluster("Chat Entities"):
                    conversations = Blank("conversations\nid, user_id, title\ncreated_at, updated_at")
                    messages = Blank("messages\nid, conversation_id\ncontent, role, created_at")
                    generations = Blank("generations\nid, message_id, provider\nstatus, tokens, cost")
                
                with Cluster("Usage Tracking"):
                    usage_records = Blank("usage_records\nid, user_id, tokens\ncost, created_at")
                    plans = Blank("plans\nid, name, daily_limit\ntoken_limit")
                    user_plans = Blank("user_plans\nid, user_id, plan_id\nstart_date, end_date")
                
                with Cluster("Administration"):
                    audit_logs = Blank("audit_logs\nid, user_id, action\ndetails, created_at")
                    attachments = Blank("attachments\nid, user_id, filename\nsize, content_type")
            
            # Database users
            with Cluster("Database Access"):
                admin_user = Blank("chatadmin\nFull schema access")
                runtime_user = Blank("chat_runtime\nApplication CRUD")
                observer_user = Blank("chat_observer\nRead-only analytics")
            
            # Relationships
            users >> Edge(label="1:N") >> sessions
            users >> Edge(label="1:N") >> conversations
            users >> Edge(label="1:N") >> usage_records
            users >> Edge(label="1:N") >> audit_logs
            users >> Edge(label="1:N") >> attachments
            users >> Edge(label="M:N") >> user_plans >> plans
            
            conversations >> Edge(label="1:N") >> messages
            messages >> Edge(label="1:1") >> generations
            
            # Access patterns
            runtime_user >> Edge(label="CRUD", color="blue") >> users
            runtime_user >> Edge(label="CRUD", color="blue") >> conversations
            runtime_user >> Edge(label="CRUD", color="blue") >> messages
            observer_user >> Edge(label="SELECT", color="green") >> usage_records
            admin_user >> Edge(label="DDL", color="red") >> postgres
        
        return filename

    def generate_user_workflow(self) -> str:
        """Generate user workflow diagram showing end-to-end user journey."""
        filename = "user-workflow"
        
        with Diagram(
            "YounderChat User Workflow",
            filename=str(self.output_dir / filename),
            graph_attr=self.graph_attr,
            node_attr=self.node_attr,
            edge_attr=self.edge_attr,
            show=False,
            direction="TB"
        ):
            # User entry points
            with Cluster("User Journey"):
                user = Users("User")
                browser = Blank("Browser\nReact + TypeScript")
            
            # Authentication flow
            with Cluster("Authentication"):
                login = Blank("Login/Register\nForm")
                auth_check = Blank("Password\nVerification")
                session_create = Blank("Session\nCreation")
                cookie = Blank("HttpOnly Cookie\nSecure + SameSite")
            
            # Application flow
            with Cluster("Application Features"):
                dashboard = Blank("Dashboard\nConversation List")
                chat = Blank("Chat Interface\nMessage Input/Display")
                settings = Blank("Settings\nProfile/Preferences")
                admin = Blank("Admin Panel\nUser Management")
            
            # Backend services
            with Cluster("Azure Backend"):
                container_app = ContainerApps("Container App\nFastAPI + Authorization")
                
                with Cluster("Core Services"):
                    auth_service = Blank("Authentication\nService")
                    chat_service = Blank("Chat Service")
                    generation_service = Blank("Generation\nService")
                    user_service = Blank("User Management\nService")
                
                postgres = DatabaseForPostgresqlServers("PostgreSQL\nPersistent Storage")
                keyvault = KeyVaults("Key Vault\nSecrets Management")
            
            # External integrations
            with Cluster("External Services"):
                gemini = Saas("Google Gemini\nAI Generation")
                groq = Saas("Groq API\nAI Generation")
            
            # User flow
            user >> browser >> login
            login >> auth_check >> session_create >> cookie
            cookie >> dashboard
            dashboard >> chat
            dashboard >> settings
            cookie >> Edge(label="admin role") >> admin
            
            # Backend interactions
            browser >> Edge(label="HTTP + CSRF") >> container_app
            container_app >> auth_service >> postgres
            container_app >> chat_service >> postgres
            container_app >> generation_service
            container_app >> user_service >> postgres
            
            # Secret management
            container_app >> Edge(style="dashed", label="Managed Identity") >> keyvault
            
            # AI integration
            generation_service >> gemini
            generation_service >> groq
            
            # Data persistence
            auth_service >> postgres
            chat_service >> postgres
            generation_service >> postgres
            user_service >> postgres
        
        return filename

    def generate_all_diagrams(self) -> List[str]:
        """Generate all Azure architecture diagrams in ultra-HD resolution."""
        print("🎨 Generating professional Ultra-HD Azure architecture diagrams...")
        
        diagrams = [
            ("System Overview", self.generate_system_overview),
            ("Azure Infrastructure", self.generate_azure_infrastructure),
            ("Network Topology", self.generate_network_topology),
            ("Security Architecture", self.generate_security_architecture),
            ("CI/CD Pipeline", self.generate_cicd_pipeline),
            ("Data Model", self.generate_data_model),
            ("User Workflow", self.generate_user_workflow),
        ]
        
        generated_files = []
        
        for name, generator_func in diagrams:
            try:
                print(f"  ✨ Generating {name} in Ultra-HD...")
                filename = generator_func()
                generated_files.append(f"{filename}.png")
                print(f"  ✅ Generated {filename}.png (Ultra-HD)")
            except Exception as e:
                print(f"  ❌ Failed to generate {name}: {e}")
        
        print(f"\n🎉 Successfully generated {len(generated_files)} Ultra-HD Azure diagrams!")
        print(f"📁 Output directory: {self.output_dir}")
        print(f"📊 Resolution: 300 DPI with enhanced fonts and spacing")
        
        return generated_files


if __name__ == "__main__":
    # Generate all diagrams
    generator = AzureDiagramGenerator()
    generated_files = generator.generate_all_diagrams()
    
    print("\n📊 Generated Diagrams:")
    for file in generated_files:
        print(f"  - {file}")
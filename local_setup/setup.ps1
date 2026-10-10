#!/usr/bin/env pwsh
# YounderChat Local Development Setup & Start Script

param(
    [switch]$Setup = $false,
    [switch]$Start = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Change to workspace root
$WorkspaceRoot = Split-Path $MyInvocation.MyCommand.Path -Parent | Split-Path -Parent
Set-Location $WorkspaceRoot

function Show-Usage {
    Write-Host ""
    Write-Host "YounderChat Local Development" -ForegroundColor Green
    Write-Host ""
    Write-Host "USAGE:" -ForegroundColor Yellow
    Write-Host "  .\local_setup\setup.ps1 -Setup    # One-time setup (run first time only)"
    Write-Host "  .\local_setup\setup.ps1 -Start     # Start application servers"
    Write-Host ""
    Write-Host "DEMO LOGIN:" -ForegroundColor Yellow  
    Write-Host "  Email: demo@local.dev"
    Write-Host "  Password: DemoPassword123!"
    Write-Host ""
    Write-Host "URLS:" -ForegroundColor Yellow
    Write-Host "  Application: http://localhost:5173"
    Write-Host "  API Docs: http://localhost:8005/docs"
    Write-Host ""
}

function Install-Dependencies {
    Write-Host "Setup: Setting up YounderChat local development..." -ForegroundColor Green
    Write-Host ""

    # Check Python
    Write-Host "Setup: Checking Python..." -ForegroundColor Yellow
    try {
        $pythonVersion = python --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Setup: Found $pythonVersion" -ForegroundColor Green
        } else {
            throw "Python not found"
        }
    } catch {
        Write-Host "Error: Python 3.12+ required. Please install Python and add to PATH." -ForegroundColor Red
        exit 1
    }

    # Backend setup
    Write-Host "Setup: Setting up backend..." -ForegroundColor Yellow
    Set-Location backend

    # Create virtual environment
    if (-not (Test-Path ".venv")) {
        Write-Host "Setup: Creating Python virtual environment..." -ForegroundColor Cyan
        python -m venv .venv
    }

    # Activate virtual environment
    if (Test-Path ".venv/Scripts/Activate.ps1") {
        & ".\.venv\Scripts\Activate.ps1"
        Write-Host "Setup: Virtual environment activated" -ForegroundColor Green
    } else {
        Write-Host "Error: Failed to create virtual environment" -ForegroundColor Red
        exit 1
    }

    # Install Python dependencies
    Write-Host "Setup: Installing Python dependencies..." -ForegroundColor Cyan
    if (Test-Path "requirements.txt") {
        pip install -r requirements.txt | Out-Null
    } elseif (Test-Path "requirements.lock") {
        pip install -r requirements.lock | Out-Null
    } elseif (Test-Path "pyproject.toml") {
        pip install -e ".[dev]" | Out-Null
    } else {
        Write-Host "Error: No dependency file found (requirements.txt, requirements.lock, or pyproject.toml)" -ForegroundColor Red
        exit 1
    }
    Write-Host "Setup: Python dependencies installed" -ForegroundColor Green

    # Setup environment
    Write-Host "Setup: Configuring environment..." -ForegroundColor Cyan
    if (Test-Path "../.env.local") {
        Copy-Item "../.env.local" ".env" -Force
        Write-Host "Setup: Environment configured" -ForegroundColor Green
    } else {
        Write-Host "Error: .env.local not found" -ForegroundColor Red
        exit 1
    }

    # Run migrations
    Write-Host "Setup: Running database migrations..." -ForegroundColor Cyan
    python -m alembic upgrade head | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Setup: Database migrations completed" -ForegroundColor Green
    } else {
        Write-Host "Error: Migration failed" -ForegroundColor Red
        exit 1
    }

    # Create demo user
    Write-Host "Setup: Creating demo user..." -ForegroundColor Cyan
    $createUserScript = @"
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_engine
from app.models.entities import User, now
from app.services.security import hasher
from app.services.subscriptions import provision_basic

try:
    with Session(get_engine()) as db:
        existing = db.scalar(select(User).where(User.email == 'demo@local.dev'))
        if existing:
            print('Demo user already exists')
        else:
            user = User(
                email='demo@local.dev',
                name='Demo User',
                password_hash=hasher.hash('DemoPassword123!'),
                role='admin',
                verified_user=True,
                email_verified_at=now()
            )
            db.add(user)
            db.flush()
            provision_basic(db, user)
            db.commit()
            print('Demo user created successfully')
except Exception as e:
    print(f'Error: {e}')
    exit(1)
"@

    $createUserScript | python
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Setup: Demo user ready" -ForegroundColor Green
    } else {
        Write-Host "Warning: Demo user setup had issues (may already exist)" -ForegroundColor Yellow
    }

    # Return to workspace root
    Set-Location ..

    # Check Node.js
    Write-Host "Setup: Checking Node.js..." -ForegroundColor Yellow
    try {
        $nodeVersion = node --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Setup: Found Node.js $nodeVersion" -ForegroundColor Green
        } else {
            throw "Node.js not found"
        }
    } catch {
        Write-Host "Error: Node.js 18+ required. Please install Node.js." -ForegroundColor Red
        exit 1
    }

    # Frontend setup
    Write-Host "Setup: Setting up frontend..." -ForegroundColor Yellow
    Set-Location frontend

    Write-Host "Setup: Installing Node dependencies..." -ForegroundColor Cyan
    npm ci | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Setup: Frontend dependencies installed" -ForegroundColor Green
    } else {
        Write-Host "Error: Failed to install frontend dependencies" -ForegroundColor Red
        exit 1
    }

    # Return to workspace root
    Set-Location ..

    Write-Host ""
    Write-Host "Success: Setup completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  .\local_setup\setup.ps1 -Start" -ForegroundColor Cyan
    Write-Host ""
}

function Start-Application {
    Write-Host "Start: Starting YounderChat..." -ForegroundColor Green
    Write-Host ""

    # Check if setup was done
    if (-not (Test-Path "backend/.venv") -or -not (Test-Path "frontend/node_modules")) {
        Write-Host "Error: Setup required first. Run:" -ForegroundColor Red
        Write-Host "   .\local_setup\setup.ps1 -Setup" -ForegroundColor Yellow
        exit 1
    }

    # Start backend
    Write-Host "Start: Starting backend server..." -ForegroundColor Yellow
    $backendJob = Start-Job -ScriptBlock {
        param($workspaceRoot)
        Set-Location "$workspaceRoot\backend"
        & ".\.venv\Scripts\Activate.ps1"
        python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8005
    } -ArgumentList $WorkspaceRoot

    # Wait for backend to start
    Start-Sleep -Seconds 3

    # Start frontend
    Write-Host "Start: Starting frontend server..." -ForegroundColor Yellow
    $frontendJob = Start-Job -ScriptBlock {
        param($workspaceRoot)
        Set-Location "$workspaceRoot\frontend"
        npm run dev
    } -ArgumentList $WorkspaceRoot

    Write-Host ""
    Write-Host "Success: YounderChat is starting up!" -ForegroundColor Green
    Write-Host ""
    Write-Host "URLs:" -ForegroundColor Yellow
    Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "  Backend:  http://localhost:8005" -ForegroundColor Cyan
    Write-Host "  API Docs: http://localhost:8005/docs" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Demo Login:" -ForegroundColor Yellow
    Write-Host "  Email: demo@local.dev" -ForegroundColor Cyan
    Write-Host "  Password: DemoPassword123!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Ctrl+C to stop all servers..." -ForegroundColor Red
    Write-Host ""

    try {
        while ($true) {
            # Check if jobs failed
            if ($backendJob.State -eq "Failed") {
                Write-Host "Error: Backend server failed!" -ForegroundColor Red
                Receive-Job $backendJob
                break
            }
            if ($frontendJob.State -eq "Failed") {
                Write-Host "Error: Frontend server failed!" -ForegroundColor Red
                Receive-Job $frontendJob
                break
            }

            Start-Sleep -Seconds 2
        }
    } finally {
        Write-Host ""
        Write-Host "Stop: Stopping servers..." -ForegroundColor Yellow
        
        # Stop jobs gracefully
        if ($backendJob.State -eq "Running") { Stop-Job $backendJob }
        if ($frontendJob.State -eq "Running") { Stop-Job $frontendJob }
        
        Remove-Job $backendJob -Force -ErrorAction SilentlyContinue
        Remove-Job $frontendJob -Force -ErrorAction SilentlyContinue
        
        Write-Host "Success: All servers stopped" -ForegroundColor Green
    }
}

# Main script logic
if ($Setup) {
    Install-Dependencies
} elseif ($Start) {
    Start-Application
} else {
    Show-Usage
}
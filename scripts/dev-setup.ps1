#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Change to workspace root
$WorkspaceRoot = Split-Path $MyInvocation.MyCommand.Path -Parent | Split-Path -Parent
Set-Location $WorkspaceRoot

Write-Host "🚀 Setting up YounderChat local development environment..." -ForegroundColor Green

# Check Python version
Write-Host "📋 Checking Python version..." -ForegroundColor Yellow
try {
    $PythonVersion = python --version
    Write-Host "✅ Found: $PythonVersion" -ForegroundColor Green
    
    # Check if Python 3.12+
    $VersionNumber = ($PythonVersion -split ' ')[1]
    $Major, $Minor = $VersionNumber -split '\.'
    if ([int]$Major -lt 3 -or ([int]$Major -eq 3 -and [int]$Minor -lt 12)) {
        throw "Python 3.12+ required, found $VersionNumber"
    }
} catch {
    Write-Host "❌ Python 3.12+ is required. Please install Python and add it to PATH." -ForegroundColor Red
    exit 1
}

# Create and activate backend virtual environment
Write-Host "📋 Setting up Python virtual environment..." -ForegroundColor Yellow
Set-Location backend
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}
& ".venv/Scripts/Activate.ps1"

# Install backend dependencies
Write-Host "📋 Installing backend dependencies..." -ForegroundColor Yellow
if (Test-Path "requirements.txt") {
    pip install -r requirements.txt
} elseif (Test-Path "pyproject.toml") {
    pip install -e ".[dev]"
} else {
    Write-Host "❌ No requirements.txt or pyproject.toml found in backend/" -ForegroundColor Red
    exit 1
}

# Copy .env.local to backend/.env if needed
Write-Host "📋 Setting up environment configuration..." -ForegroundColor Yellow
$EnvPath = ".env"
if (-not (Test-Path $EnvPath)) {
    Copy-Item "../.env.local" $EnvPath
    Write-Host "✅ Copied .env.local to backend/.env" -ForegroundColor Green
} else {
    $overwrite = Read-Host "backend/.env already exists. Overwrite with .env.local? (y/N)"
    if ($overwrite -eq 'y' -or $overwrite -eq 'Y') {
        Copy-Item "../.env.local" $EnvPath -Force
        Write-Host "✅ Overwrote backend/.env with .env.local" -ForegroundColor Green
    }
}

# Run database migrations
Write-Host "📋 Running database migrations..." -ForegroundColor Yellow
try {
    python -m alembic upgrade head
    Write-Host "✅ Database migrations completed" -ForegroundColor Green
} catch {
    Write-Host "❌ Migration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Seed demo user
Write-Host "📋 Creating demo user..." -ForegroundColor Yellow
$SeedScript = @"
import sys
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
                password_hash=hasher.hash('Demo1234!'),
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
    print(f'Error creating demo user: {e}')
    sys.exit(1)
"@

$SeedScript | python
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create demo user" -ForegroundColor Red
    exit 1
}

# Return to workspace root
Set-Location ..

# Check Node version
Write-Host "📋 Checking Node.js version..." -ForegroundColor Yellow
try {
    $NodeVersion = node --version
    Write-Host "✅ Found Node.js: $NodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is required. Please install Node.js 18+ and add it to PATH." -ForegroundColor Red
    exit 1
}

# Install frontend dependencies
Write-Host "📋 Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
try {
    npm ci
    Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install frontend dependencies" -ForegroundColor Red
    exit 1
}

# Return to workspace root
Set-Location ..

Write-Host ""
Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📖 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Run: .\scripts\dev-start.ps1" -ForegroundColor White
Write-Host "  2. Open browser to: http://localhost:5173" -ForegroundColor White
Write-Host "  3. Login with:" -ForegroundColor White
Write-Host "     Email: demo@local.dev" -ForegroundColor Cyan
Write-Host "     Password: Demo1234!" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 For more information, see scripts\README.md" -ForegroundColor Yellow
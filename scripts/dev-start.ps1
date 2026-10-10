#!/usr/bin/env pwsh
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Change to workspace root
$WorkspaceRoot = Split-Path $MyInvocation.MyCommand.Path -Parent | Split-Path -Parent
Set-Location $WorkspaceRoot

Write-Host "🚀 Starting YounderChat development servers..." -ForegroundColor Green

# Start backend server in background
Write-Host "📋 Starting backend server..." -ForegroundColor Yellow
$BackendJob = Start-Job -ScriptBlock {
    param($WorkspaceRoot)
    Set-Location "$WorkspaceRoot\backend"
    & ".venv\Scripts\Activate.ps1"
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8005 --env-file .env
} -ArgumentList $WorkspaceRoot

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend server in background
Write-Host "📋 Starting frontend server..." -ForegroundColor Yellow
$FrontendJob = Start-Job -ScriptBlock {
    param($WorkspaceRoot)
    Set-Location "$WorkspaceRoot\frontend"
    npm run dev
} -ArgumentList $WorkspaceRoot

Write-Host ""
Write-Host "🎉 Development servers are starting..." -ForegroundColor Green
Write-Host ""
Write-Host "🔗 URLs:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "  Backend API: http://localhost:8005" -ForegroundColor Cyan
Write-Host "  API Documentation: http://localhost:8005/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "👤 Demo Login:" -ForegroundColor Yellow
Write-Host "  Email: demo@local.dev" -ForegroundColor White
Write-Host "  Password: Demo1234!" -ForegroundColor White
Write-Host ""
Write-Host "📊 Job Status:" -ForegroundColor Yellow

# Monitor jobs and show output
$jobs = @($BackendJob, $FrontendJob)
$jobNames = @("Backend", "Frontend")

try {
    while ($true) {
        for ($i = 0; $i -lt $jobs.Count; $i++) {
            $job = $jobs[$i]
            $name = $jobNames[$i]
            
            if ($job.State -eq "Failed") {
                Write-Host "❌ $name server failed!" -ForegroundColor Red
                Receive-Job $job -ErrorAction SilentlyContinue
                break
            } elseif ($job.State -eq "Completed") {
                Write-Host "⚠️  $name server stopped" -ForegroundColor Yellow
            }
        }
        
        Start-Sleep -Seconds 5
        
        # Check if user wants to stop
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            if ($key.Key -eq [ConsoleKey]::Escape -or ($key.Modifiers -eq [ConsoleModifiers]::Control -and $key.Key -eq [ConsoleKey]::C)) {
                break
            }
        }
    }
} finally {
    Write-Host ""
    Write-Host "🛑 Stopping development servers..." -ForegroundColor Yellow
    
    # Stop all jobs
    $jobs | ForEach-Object {
        if ($_.State -eq "Running") {
            Stop-Job $_
        }
        Remove-Job $_ -Force
    }
    
    Write-Host "✅ Development servers stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "Press Enter to exit..."
Read-Host
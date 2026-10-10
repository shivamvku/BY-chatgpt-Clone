$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { throw "Python 3.12+ is required and must be on PATH." }
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "Node.js 22+ and npm are required." }
python -c "import sys; assert sys.version_info >= (3, 12), 'Python 3.12+ is required'"
if ($LASTEXITCODE -ne 0) { throw "Python 3.12+ is required." }
node -e "if (Number(process.versions.node.split('.')[0]) < 22) process.exit(1)"
if ($LASTEXITCODE -ne 0) { throw "Node.js 22+ is required." }
if (-not (Test-Path ".venv\Scripts\python.exe")) { python -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r backend/requirements-dev.lock
& .\.venv\Scripts\python.exe -m pip install --no-deps -e "./backend[dev]"
if (-not (Test-Path "frontend\node_modules")) { Push-Location frontend; try { npm ci } finally { Pop-Location } }
$env:APP_ENV = "development"
$env:DATABASE_URL = "sqlite:///./local.db"
$env:SKIP_EMAIL_VERIFICATION = "true"
$env:PUBLIC_URL = "http://localhost:5173"
$env:ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:8000"
$env:SERVE_FRONTEND = "false"
Push-Location backend
try { & ..\.venv\Scripts\python.exe -m app.local_setup } finally { Pop-Location }
$Backend = Start-Process -FilePath "$Root\.venv\Scripts\python.exe" -ArgumentList "-m","uvicorn","app.main:app","--reload","--host","127.0.0.1","--port","8000" -WorkingDirectory (Join-Path $Root "backend") -PassThru
$Frontend = Start-Process -FilePath "npm.cmd" -ArgumentList "run","dev","--","--host","127.0.0.1","--port","5173" -WorkingDirectory (Join-Path $Root "frontend") -PassThru
try {
    Write-Host "YounderChat local demo:"
    Write-Host "  UI:       http://localhost:5173"
    Write-Host "  API docs: http://localhost:8000/api/docs"
    Write-Host "  Health:   http://localhost:8000/api/health/live"
    Write-Host "Admin: admin@younderchat.local / AdminDemo!2026"
    Write-Host "User:  user@younderchat.local  / UserDemo!2026"
    Write-Host "For real LLM responses, set GEMINI_API_KEY and/or GROQ_API_KEY before launch."
    Write-Host "Press Ctrl+C to stop both servers. SQLite data is stored in backend/local.db."
    while (-not $Backend.HasExited -and -not $Frontend.HasExited) { Start-Sleep -Seconds 1 }
    if ($Backend.HasExited -and $Backend.ExitCode -ne 0) { throw "Backend exited unexpectedly." }
    if ($Frontend.HasExited -and $Frontend.ExitCode -ne 0) { throw "Frontend exited unexpectedly." }
}
finally {
    foreach ($Process in @($Backend, $Frontend)) {
        if ($Process -and -not $Process.HasExited) { Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue }
    }
}

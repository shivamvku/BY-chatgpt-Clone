# YounderChat Local Development Setup

This directory contains PowerShell scripts for easy local development of YounderChat.

## Prerequisites

- **Python 3.12+** - [Download from python.org](https://www.python.org/downloads/)
- **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)
- **PowerShell 7+** - Pre-installed on Windows 10/11
- **Git** - For cloning the repository

## Quick Start

1. **One-time setup** (run once):
   ```powershell
   .\scripts\dev-setup.ps1
   ```

2. **Daily development** (run every session):
   ```powershell
   .\scripts\dev-start.ps1
   ```

3. **Open your browser** to http://localhost:5173

## Demo Credentials

- **Email**: `demo@local.dev`
- **Password**: `Demo1234!`
- **Role**: Admin (for testing admin features)

## URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8005
- **API Documentation**: http://localhost:8005/docs (Swagger UI)

## Configuration

### Environment Variables

The setup uses `.env.local` for local development configuration:

- **SQLite Database**: `DATABASE_URL=sqlite:///./local.db`
- **Email Verification**: Disabled with `SKIP_EMAIL_VERIFICATION=true`
- **CORS**: Configured for `http://localhost:5173`

### AI API Keys

To enable AI chat features, add your API keys to `backend/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key-here
GROQ_API_KEY=your-groq-api-key-here
```

Without these keys, the model selection will show "No models configured".

## Project Structure

```
YounderChat/
├── backend/           # FastAPI backend
│   ├── app/          # Application code
│   ├── migrations/   # Database migrations
│   ├── tests/        # Backend tests
│   └── .env          # Environment config (created by setup)
├── frontend/         # React frontend
│   └── src/         # Frontend source code
└── scripts/         # Development scripts
    ├── dev-setup.ps1    # One-time setup
    ├── dev-start.ps1    # Start development servers
    └── README.md        # This file
```

## Development Workflow

1. **Backend changes**: The backend auto-reloads when Python files change
2. **Frontend changes**: The frontend auto-reloads when TypeScript/React files change
3. **Database changes**: Create migrations with `alembic revision --autogenerate -m "description"`
4. **Testing**: Run `pytest` in the backend directory or `npm test` in frontend

## Troubleshooting

### Python Issues

- **"python not found"**: Ensure Python 3.12+ is installed and in PATH
- **Virtual environment issues**: Delete `backend/.venv` and re-run setup
- **Permission errors**: Run PowerShell as Administrator

### Node.js Issues

- **"npm not found"**: Ensure Node.js 18+ is installed and in PATH
- **Package installation fails**: Delete `frontend/node_modules` and `frontend/package-lock.json`, then re-run setup
- **Port 5173 in use**: Kill other Vite processes or change port in `frontend/vite.config.ts`

### Database Issues

- **Migration errors**: Check if SQLite file is locked by another process
- **Demo user creation fails**: Ensure database is properly migrated
- **Permission denied**: Check file permissions on the SQLite database file

### Network Issues

- **Backend not accessible**: Check if port 8005 is available
- **CORS errors**: Verify `ALLOWED_ORIGINS` in backend `.env` includes frontend URL
- **API requests fail**: Ensure both servers are running and accessible

### Common Solutions

1. **Clean restart**: Stop servers, delete `local.db`, and re-run setup
2. **Check logs**: PowerShell jobs show output in the terminal
3. **Verify environment**: Ensure `.env` files have correct values
4. **Update dependencies**: Re-run `dev-setup.ps1` to update packages

## Production Differences

This local setup differs from production:

- Uses SQLite instead of PostgreSQL
- Skips email verification
- Uses HTTP instead of HTTPS
- Has relaxed CORS settings
- Includes debug logging

## Interview Setup

For evaluation purposes, this setup allows:

1. **Quick deployment**: Under 5 minutes from clone to running app
2. **Full functionality**: All features work without external dependencies
3. **Admin access**: Demo user has administrative privileges
4. **No Docker required**: Direct Python/Node.js execution
5. **Self-contained**: No external services needed

## Getting Help

1. Check this README for common issues
2. Verify prerequisites are correctly installed
3. Review PowerShell script output for specific error messages
4. Ensure no other applications are using ports 5173 or 8005
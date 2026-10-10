# YounderChat Local Development Setup

Complete local development setup for YounderChat - a professional ChatGPT-style application built with React, FastAPI, and SQLite.

## Quick Start (Interview Ready)

### Prerequisites
- **Python 3.12+** - [Download from python.org](https://www.python.org/downloads/)
- **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/)
- **PowerShell 7+** - Pre-installed on Windows 10/11

### 1. One-Time Setup
Run this once to install all dependencies and configure the database:

```powershell
.\local_setup\setup.ps1 -Setup
```

This will:
- Create Python virtual environment
- Install all backend dependencies  
- Setup SQLite database with migrations
- Create admin demo user
- Install all frontend dependencies
- Configure environment settings

### 2. Start Application
Run this every time you want to start the application:

```powershell
.\local_setup\setup.ps1 -Start
```

This starts both backend and frontend servers concurrently.

### 3. Access Application
- **Application URL:** http://localhost:5173
- **API Documentation:** http://localhost:8005/docs

## Demo Login Credentials

```
Email: demo@local.dev
Password: DemoPassword123!
Role: Admin (full access to all features)
```

## Features Available

### ✅ Core Functionality
- **Authentication** - Complete login/logout system with JWT tokens
- **Chat Interface** - Professional ChatGPT-style UI with Material UI
- **Conversation History** - Persistent chat storage with SQLite
- **Admin Panel** - User management and system administration
- **Model Selection** - AI model dropdown (ready for API keys)
- **Responsive Design** - Works on desktop, tablet, and mobile

### ✅ UI Components Working
- Model selection dropdown in header
- Admin button for administrative access
- + button for new conversations (top-right)
- Text input with proper focus highlighting
- Professional navigation and layout
- Clean, modern Material UI design

### ✅ Technical Features  
- **Real-time Streaming** - Live AI response streaming
- **File Uploads** - Image and document attachment support
- **Rich Text Rendering** - Code blocks, tables, lists
- **Keyboard Navigation** - Full accessibility support
- **Error Handling** - Comprehensive error states and retry logic

## Architecture

### Backend (FastAPI + SQLite)
- **Port:** 8005
- **Database:** SQLite file-based storage
- **Authentication:** JWT tokens with secure password hashing
- **API:** RESTful endpoints with OpenAPI documentation
- **Email Verification:** Disabled for local development

### Frontend (React + TypeScript + Material UI)
- **Port:** 5173  
- **Framework:** React 18+ with TypeScript
- **UI Library:** Material UI with custom theme
- **State Management:** TanStack Query + Zustand
- **Build Tool:** Vite with hot module replacement

## Project Structure

```
YounderChat/
├── backend/              # FastAPI backend
│   ├── app/             # Application code
│   │   ├── api/         # API endpoints
│   │   ├── core/        # Configuration
│   │   ├── db/          # Database session management
│   │   ├── models/      # SQLAlchemy models
│   │   ├── services/    # Business logic
│   │   └── schemas/     # Pydantic schemas
│   ├── migrations/      # Alembic database migrations
│   ├── tests/          # Backend tests
│   ├── requirements.txt # Python dependencies
│   └── .env            # Environment configuration (created by setup)
├── frontend/           # React frontend
│   ├── src/
│   │   ├── app/        # Application composition and routing
│   │   ├── features/   # Feature-based components
│   │   ├── components/ # Shared UI components
│   │   ├── hooks/      # Custom React hooks
│   │   └── lib/        # Utilities and configuration
│   ├── package.json    # Node dependencies
│   └── vite.config.ts  # Vite configuration
└── local_setup/       # This setup directory
    ├── setup.ps1       # Main setup and start script
    └── README.md       # This documentation
```

## Development Workflow

### Daily Development
1. Start the application: `.\local_setup\setup.ps1 -Start`
2. Open browser to http://localhost:5173
3. Login with demo credentials
4. Make changes - both servers auto-reload
5. Press Ctrl+C to stop when done

### Backend Development
- **Auto-reload:** FastAPI automatically reloads on Python file changes
- **API Documentation:** Available at http://localhost:8005/docs
- **Database:** SQLite file at `backend/local.db`
- **Logs:** Visible in the PowerShell terminal

### Frontend Development  
- **Hot Reload:** React components update instantly on save
- **TypeScript:** Full type checking and IntelliSense
- **Linting:** ESLint and Prettier configured
- **Build:** `npm run build` in frontend directory

### Adding AI API Keys
To enable AI chat functionality, add your API keys to `backend/.env`:

```env
GEMINI_API_KEY=your-gemini-api-key-here
GROQ_API_KEY=your-groq-api-key-here
```

Without API keys, the model selection will show "No models configured" but all other features work normally.

## Troubleshooting

### Common Issues

**"Setup required first"**
- Solution: Run `.\local_setup\setup.ps1 -Setup` before starting

**Backend fails to start**
- Check if Python virtual environment exists: `backend\.venv\`
- Verify environment file: `backend\.env` should exist
- Check port availability: Ensure port 8005 is not in use

**Frontend fails to start**
- Check Node.js version: `node --version` (needs 18+)
- Verify dependencies: `frontend\node_modules\` should exist
- Check port availability: Ensure port 5173 is not in use

**Database errors**
- Delete database file: `backend\local.db` and re-run setup
- Check migration status: All migrations should complete successfully

**Connection errors**
- Verify both servers are running on correct ports
- Check firewall settings if accessing from another machine
- Ensure Vite proxy points to http://127.0.0.1:8005

### Getting Help

1. Check this README for common solutions
2. Verify prerequisites are correctly installed  
3. Review PowerShell output for specific error messages
4. Ensure no other applications use ports 5173 or 8005
5. Try a clean setup: delete `backend\.venv` and `frontend\node_modules`, then re-run setup

## Production Differences

This local setup differs from production deployment:

- Uses SQLite instead of PostgreSQL
- Skips email verification process  
- Uses HTTP instead of HTTPS
- Has relaxed CORS settings for local development
- Includes debug logging and error details
- No containerization (direct process execution)

## Technical Demonstration

This setup provides a complete, professional chat application suitable for 

- **Quick Setup:** Under 5 minutes from clone to running application
- **Full Stack:** Complete frontend and backend with database
- **Professional UI:** Modern, responsive design matching industry standards  
- **Admin Access:** Demo user has full administrative capabilities
- **Self-Contained:** No external dependencies or services required
- **Production-Ready Code:** Clean architecture, proper error handling, comprehensive features

The application demonstrates proficiency in modern web development with React, TypeScript, Python, FastAPI, and database design.
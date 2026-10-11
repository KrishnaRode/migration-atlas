@echo off
REM Migration Atlas - one-command local start (Windows).
REM   start.bat
REM   set API_PORT=8020 & set WEB_PORT=3020 & start.bat
setlocal
set ROOT=%~dp0
if "%API_PORT%"=="" set API_PORT=8014
if "%WEB_PORT%"=="" set WEB_PORT=3014

echo.
echo  Migration Atlas - local AI migration architecture studio
echo.

where python >nul 2>nul || (echo  [x] Python 3.10+ is required: https://www.python.org/downloads/ & exit /b 1)
where node >nul 2>nul || (echo  [x] Node.js 18.18+ is required: https://nodejs.org & exit /b 1)
where ollama >nul 2>nul && (
  curl -fsS http://127.0.0.1:11434/api/version >nul 2>nul || start "" /b ollama serve
) || echo  [!] Ollama not found - install from https://ollama.com/download for AI features.

echo  - Installing backend
cd /d "%ROOT%apps\backend"
if not exist .venv\Scripts\python.exe python -m venv .venv
.venv\Scripts\python.exe -c "import fastapi, networkx, reportlab" 2>nul || .venv\Scripts\python.exe -m pip install -q -e ".[dev]"

echo  - Installing web app
cd /d "%ROOT%apps\web"
if not exist node_modules call npm install --no-audit --no-fund --loglevel=error

echo  - Starting API on :%API_PORT%
cd /d "%ROOT%apps\backend"
set ATLAS_CORS_ORIGINS=http://localhost:%WEB_PORT%,http://127.0.0.1:%WEB_PORT%
start "Migration Atlas API" .venv\Scripts\python.exe -m uvicorn atlas.main:app --host 127.0.0.1 --port %API_PORT%

echo  - Starting web on :%WEB_PORT%
cd /d "%ROOT%apps\web"
set NEXT_PUBLIC_API_URL=http://127.0.0.1:%API_PORT%
start "Migration Atlas Web" cmd /c "npm run dev"

timeout /t 6 >nul
start "" http://localhost:%WEB_PORT%
echo.
echo  Migration Atlas is running at http://localhost:%WEB_PORT%
echo  Close the two server windows to stop. Architecture data stays on this machine.
endlocal

@echo off
echo 🏔️ Mountain Highway - Quick Start
echo ================================

REM Kill existing processes
taskkill /f /im node.exe >nul 2>&1

REM Start both servers
echo Starting API server...
start "API" /min cmd /c "cd /d "%~dp0packages\api" && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Web server...
start "Web" /min cmd /c "cd /d "%~dp0packages\web" && npm run dev"

timeout /t 5 /nobreak >nul

echo Opening application...
start "" "http://localhost:5173"

echo ✅ Mountain Highway started!
echo Frontend: http://localhost:5173
echo API: http://localhost:4000

pause

@echo off
echo.
echo =========================================
echo   🏔️ MOUNTAIN HIGHWAY MARKETPLACE 
echo =========================================
echo.

REM Store the current directory
set "PROJECT_ROOT=%~dp0"

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js detected
echo.

REM Kill any existing processes on our ports
echo 🔄 Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo 🚀 Starting Mountain Highway servers...
echo.

REM Start API server in a new window
echo 📡 Starting API Server (Port 4000)...
start "Mountain Highway API" /min cmd /c "cd /d "%PROJECT_ROOT%packages\api" && npm run dev"

REM Wait a moment for API to start
timeout /t 3 /nobreak >nul

REM Start Web server in a new window  
echo 🌐 Starting Web Server (Port 5173)...
start "Mountain Highway Web" /min cmd /c "cd /d "%PROJECT_ROOT%packages\web" && npm run dev"

REM Wait for servers to fully start
echo ⏳ Waiting for servers to start...
timeout /t 8 /nobreak >nul

REM Test API health
echo 🔍 Testing API connection...
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4000/health' -TimeoutSec 5; if($response.ok) { Write-Host '✅ API Server: ONLINE' -ForegroundColor Green } else { Write-Host '❌ API Server: UNHEALTHY' -ForegroundColor Red } } catch { Write-Host '❌ API Server: OFFLINE' -ForegroundColor Red }"

echo.
echo 🎯 Opening Mountain Highway...

REM Open the main application
start "" "http://localhost:5173"

REM Wait a moment then open admin panel
timeout /t 2 /nobreak >nul
echo 🛠️ Opening Admin Panel...
start "" "http://localhost:5173/admin"

echo.
echo ========================================
echo   🎉 MOUNTAIN HIGHWAY IS READY! 
echo ========================================
echo.
echo 📱 Frontend:     http://localhost:5173
echo 🔧 API:          http://localhost:4000  
echo 👨‍💼 Admin Panel:  http://localhost:5173/admin
echo.
echo 💡 TIPS:
echo • Sign in or register to create listings
echo • Upload photos and videos with listings
echo • Use admin panel to manage orders
echo • Both servers will run in minimized windows
echo.
echo ⚠️  Press any key to STOP all servers and exit...
pause >nul

echo.
echo 🛑 Shutting down servers...

REM Kill the server processes
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /f /pid %%a >nul 2>&1
)

echo ✅ All servers stopped.
echo 👋 Thanks for using Mountain Highway!
timeout /t 2 /nobreak >nul

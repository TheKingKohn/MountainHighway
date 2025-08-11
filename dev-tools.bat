@echo off
echo.
echo ========================================
echo   🔧 MOUNTAIN HIGHWAY DEV TOOLS
echo ========================================
echo.

:MENU
echo Please choose an option:
echo.
echo 1. 🚀 Start Full Application (Frontend + Backend + Admin)
echo 2. 🌐 Start Frontend Only
echo 3. 📡 Start Backend Only  
echo 4. 🛠️ Open Admin Panel
echo 5. 🧪 Run API Tests
echo 6. 🗄️ Database Operations
echo 7. 🔍 System Status
echo 8. 🛑 Stop All Servers
echo 9. ❌ Exit
echo.

set /p choice="Enter your choice (1-9): "

if "%choice%"=="1" goto FULL_START
if "%choice%"=="2" goto WEB_ONLY
if "%choice%"=="3" goto API_ONLY
if "%choice%"=="4" goto ADMIN_ONLY
if "%choice%"=="5" goto RUN_TESTS
if "%choice%"=="6" goto DATABASE
if "%choice%"=="7" goto STATUS
if "%choice%"=="8" goto STOP_ALL
if "%choice%"=="9" goto EXIT

echo Invalid choice. Please try again.
goto MENU

:FULL_START
echo 🚀 Starting full application...
call "%~dp0start-mountain-highway.bat"
goto MENU

:WEB_ONLY
echo 🌐 Starting frontend only...
start "Mountain Highway Web" cmd /c "cd /d "%~dp0packages\web" && npm run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"
echo ✅ Frontend started: http://localhost:5173
goto MENU

:API_ONLY
echo 📡 Starting backend only...
start "Mountain Highway API" cmd /c "cd /d "%~dp0packages\api" && npm run dev"
timeout /t 3 /nobreak >nul
echo ✅ Backend started: http://localhost:4000
goto MENU

:ADMIN_ONLY
echo 🛠️ Opening admin panel...
call "%~dp0admin-panel.bat"
goto MENU

:RUN_TESTS
echo 🧪 Running API tests...
cd /d "%~dp0packages\api"
powershell -ExecutionPolicy Bypass -File "test-connectivity.ps1"
pause
goto MENU

:DATABASE
echo.
echo Database Operations:
echo 1. Run Migrations
echo 2. Seed Database  
echo 3. Reset Database
echo.
set /p dbchoice="Choose (1-3): "

cd /d "%~dp0packages\api"

if "%dbchoice%"=="1" (
    echo Running migrations...
    npm run migrate
)
if "%dbchoice%"=="2" (
    echo Seeding database...
    npm run seed
)
if "%dbchoice%"=="3" (
    echo Resetting database...
    del dev.db 2>nul
    npm run migrate
    npm run seed
)
pause
goto MENU

:STATUS
echo 🔍 Checking system status...
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js: Not installed
) else (
    for /f %%i in ('node --version') do echo ✅ Node.js: %%i
)

REM Check ports
netstat -an | findstr :4000 >nul
if errorlevel 1 (
    echo ❌ API Server: Not running (Port 4000)
) else (
    echo ✅ API Server: Running (Port 4000)
)

netstat -an | findstr :5173 >nul
if errorlevel 1 (
    echo ❌ Web Server: Not running (Port 5173)
) else (
    echo ✅ Web Server: Running (Port 5173)
)

REM Check API health
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4000/health' -TimeoutSec 3; Write-Host '✅ API Health: OK' -ForegroundColor Green } catch { Write-Host '❌ API Health: Failed' -ForegroundColor Red }"

echo.
pause
goto MENU

:STOP_ALL
echo 🛑 Stopping all servers...
taskkill /f /im node.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do taskkill /f /pid %%a >nul 2>&1
echo ✅ All servers stopped.
goto MENU

:EXIT
echo 👋 Goodbye!
exit /b 0

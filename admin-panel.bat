@echo off
echo.
echo ========================================
echo   🛠️ MOUNTAIN HIGHWAY ADMIN PANEL
echo ========================================
echo.

REM Check if API is running
powershell -Command "try { $response = Invoke-RestMethod -Uri 'http://localhost:4000/health' -TimeoutSec 3; Write-Host '✅ API Server is running' -ForegroundColor Green } catch { Write-Host '❌ API Server not detected' -ForegroundColor Red; Write-Host 'Starting servers first...' -ForegroundColor Yellow; exit 1 }"

if errorlevel 1 (
    echo.
    echo 🚀 Starting Mountain Highway servers first...
    call "%~dp0start-mountain-highway.bat"
    exit /b
)

echo.
echo 🎯 Opening Admin Tools...
echo.

REM Open various admin endpoints
echo 📊 Orders Dashboard...
start "" "http://localhost:4000/admin/orders/held"

timeout /t 1 /nobreak >nul

echo 🔍 API Health Check...
start "" "http://localhost:4000/health"

timeout /t 1 /nobreak >nul

echo 📋 Database Test...
start "" "http://localhost:4000/db-test"

timeout /t 1 /nobreak >nul

echo 🌐 Main Application...
start "" "http://localhost:5173"

echo.
echo ========================================
echo   🎉 ADMIN PANEL READY!
echo ========================================
echo.
echo 🔗 Opened URLs:
echo • 📊 Orders Dashboard: http://localhost:4000/admin/orders/held
echo • 🔍 Health Check:     http://localhost:4000/health  
echo • 📋 Database Test:    http://localhost:4000/db-test
echo • 🌐 Main App:         http://localhost:5173
echo.
echo 💡 Admin Features:
echo • View held orders awaiting fund release
echo • Process refunds and releases
echo • Monitor system health
echo • Check database status
echo.

pause

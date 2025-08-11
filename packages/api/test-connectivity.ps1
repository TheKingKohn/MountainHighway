# Test the fund release system manually
Write-Host "🔍 Testing fund release system..." -ForegroundColor Cyan

# Test 1: Health check
Write-Host "`n1. Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/health" -Method GET
    Write-Host "✅ Health check: $($response.StatusCode)" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "❌ Health check failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Database test
Write-Host "`n2. Database Test" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/db-test" -Method GET
    Write-Host "✅ Database test: $($response.StatusCode)" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "❌ Database test failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Basic API info
Write-Host "`n3. API Info" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:4000/" -Method GET
    Write-Host "✅ API info: $($response.StatusCode)" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "❌ API info failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n🔍 Fund release system basic connectivity test complete!" -ForegroundColor Cyan

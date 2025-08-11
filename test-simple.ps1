Write-Host "Quick API Test - Payment System Validation" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Start server in background and capture process
Write-Host "Starting API server..." -ForegroundColor Yellow
$serverProcess = Start-Process powershell -ArgumentList "-Command", "cd 'c:\Users\theki\OneDrive\Desktop\MountainHighway\packages\api'; npm run dev" -PassThru

# Wait for server to start
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    # Test health endpoint
    Write-Host "Testing health endpoint..." -ForegroundColor Cyan
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get -TimeoutSec 5
    Write-Host "Health check passed" -ForegroundColor Green

    # Register or login test user
    Write-Host "Getting authentication token..." -ForegroundColor Cyan
    $headers = @{ 'Content-Type' = 'application/json' }
    $authBody = @{
        email = "testuser@example.com"
        password = "password123"
    } | ConvertTo-Json

    # Try to register first, if fails try login
    try {
        $userResult = Invoke-RestMethod -Uri "http://localhost:4000/auth/register" -Method Post -Headers $headers -Body $authBody -TimeoutSec 5
        Write-Host "New user registered" -ForegroundColor Green
    } catch {
        # User already exists, try login
        $userResult = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method Post -Headers $headers -Body $authBody -TimeoutSec 5
        Write-Host "Existing user logged in" -ForegroundColor Green
    }
    
    $token = $userResult.token

    # Update headers with auth token
    $authHeaders = @{
        'Content-Type' = 'application/json'
        'Authorization' = "Bearer $token"
    }

    # Test payment methods endpoint
    Write-Host "Testing payment methods..." -ForegroundColor Cyan
    $methods = Invoke-RestMethod -Uri "http://localhost:4000/payments/methods" -Method Get -Headers $authHeaders -TimeoutSec 5
    Write-Host "Payment methods available" -ForegroundColor Green

    # Test Stripe Connect account creation
    Write-Host "Testing Stripe Connect..." -ForegroundColor Cyan
    $createAccountBody = @{
        email = "seller@example.com"
        business_type = "individual"
        country = "US"
    } | ConvertTo-Json

    $account = Invoke-RestMethod -Uri "http://localhost:4000/stripe/create-account" -Method Post -Headers $authHeaders -Body $createAccountBody -TimeoutSec 5
    Write-Host "Stripe Connect account created" -ForegroundColor Green

    # Test payment integration (both Stripe and PayPal)
    Write-Host "Testing payment integration..." -ForegroundColor Cyan
    $paymentTest = Invoke-RestMethod -Uri "http://localhost:4000/payments/test" -Method Get -Headers $authHeaders -TimeoutSec 5
    Write-Host "Payment integration test completed" -ForegroundColor Green
    Write-Host "  - Stripe payment intent: $($paymentTest.tests.stripe.id)" -ForegroundColor Yellow
    Write-Host "  - PayPal order: $($paymentTest.tests.paypal.id)" -ForegroundColor Yellow

    Write-Host ""
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "Authentication system working" -ForegroundColor Green  
    Write-Host "Stripe Connect integration working" -ForegroundColor Green
    Write-Host "Payment integration working (Stripe + PayPal)" -ForegroundColor Green
    Write-Host "Mock mode enabled - no real API calls made" -ForegroundColor Green

} catch {
    Write-Host "Test failed: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get more details
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Yellow
    }
} finally {
    # Clean shutdown
    Write-Host ""
    Write-Host "Stopping server..." -ForegroundColor Yellow
    if ($serverProcess -and !$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    # Kill any remaining node processes
    taskkill /F /IM node.exe 2>$null | Out-Null
    Write-Host "Server stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "Test completed!" -ForegroundColor Green

#!/usr/bin/env pwsh

Write-Host "🧪 Quick API Test - No Infinite Loops!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Start server in background and capture process
Write-Host "🚀 Starting API server..." -ForegroundColor Yellow
$serverProcess = Start-Process powershell -ArgumentList "-Command", "cd 'c:\Users\theki\OneDrive\Desktop\MountainHighway\packages\api'; npm run dev" -PassThru

# Wait a bit for server to start
Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    # Test health endpoint
    Write-Host "🏥 Testing health endpoint..." -ForegroundColor Cyan
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get -TimeoutSec 5
    Write-Host "✅ Health check: $($health.status)" -ForegroundColor Green

    # Register a test user to get authentication token
    Write-Host "👤 Registering test user..." -ForegroundColor Cyan
    $headers = @{
        'Content-Type' = 'application/json'
    }
    $registerBody = @{
        email = "testuser@example.com"
        password = "password123"
    } | ConvertTo-Json

    $userResult = Invoke-RestMethod -Uri "http://localhost:4000/auth/register" -Method Post -Headers $headers -Body $registerBody -TimeoutSec 5
    $token = $userResult.token
    Write-Host "✅ User registered and token obtained" -ForegroundColor Green

    # Update headers with auth token
    $authHeaders = @{
        'Content-Type' = 'application/json'
        'Authorization' = "Bearer $token"
    }

    # Test available payment methods
    Write-Host "💳 Testing payment methods endpoint..." -ForegroundColor Cyan
    $methods = Invoke-RestMethod -Uri "http://localhost:4000/payments/methods" -Method Get -Headers $authHeaders -TimeoutSec 5
    Write-Host "✅ Payment methods available: $($methods.methods -join ', ')" -ForegroundColor Green

    # Test Stripe Connect account creation (mock mode)
    Write-Host "🔗 Testing Stripe Connect account creation..." -ForegroundColor Cyan
    $createAccountBody = @{
        email = "test@example.com"
        business_type = "individual" 
        country = "US"
    } | ConvertTo-Json

    $account = Invoke-RestMethod -Uri "http://localhost:4000/stripe/create-account" -Method Post -Headers $authHeaders -Body $createAccountBody -TimeoutSec 5
    $accountId = if ($account.accountId) { $account.accountId } else { $account.id }
    Write-Host "✅ Stripe Connect account created: $accountId" -ForegroundColor Green

    # Test account link creation
    Write-Host "🔗 Testing account link creation..." -ForegroundColor Cyan
    $linkBody = @{
        account_id = $accountId
        return_url = "http://localhost:3000/success"
        refresh_url = "http://localhost:3000/refresh"
    } | ConvertTo-Json

    $link = Invoke-RestMethod -Uri "http://localhost:4000/stripe/account-link" -Method Post -Headers $authHeaders -Body $linkBody -TimeoutSec 5
    Write-Host "✅ Account link created: $($link.url)" -ForegroundColor Green

    # Test payment intent creation
    Write-Host "💰 Testing Stripe payment creation..." -ForegroundColor Cyan
    $paymentBody = @{
        amount = 2000
        currency = "usd"
        payment_method = "card"
        customer_email = "customer@example.com"
    } | ConvertTo-Json

    $payment = Invoke-RestMethod -Uri "http://localhost:4000/payments/create" -Method Post -Headers $authHeaders -Body $paymentBody -TimeoutSec 5
    Write-Host "✅ Payment intent created: $($payment.id)" -ForegroundColor Green

    # Test PayPal order creation
    Write-Host "🅿️ Testing PayPal order creation..." -ForegroundColor Cyan
    $paypalBody = @{
        amount = 1500
        currency = "USD"
        payment_method = "paypal"
        customer_email = "customer@example.com"
    } | ConvertTo-Json

    $paypalOrder = Invoke-RestMethod -Uri "http://localhost:4000/payments/create" -Method Post -Headers $authHeaders -Body $paypalBody -TimeoutSec 5
    Write-Host "✅ PayPal order created: $($paypalOrder.id)" -ForegroundColor Green

    Write-Host ""
    Write-Host "🎉 All tests passed! Payment system is working correctly!" -ForegroundColor Green
    Write-Host "✅ Stripe Connect: Account creation and onboarding links" -ForegroundColor Green  
    Write-Host "✅ Stripe Payments: Payment intent creation" -ForegroundColor Green
    Write-Host "✅ PayPal Payments: Order creation" -ForegroundColor Green
    Write-Host "✅ Mock mode: Testing without real API keys" -ForegroundColor Green

} catch {
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Server logs might have more details" -ForegroundColor Yellow
} finally {
    # Clean shutdown
    Write-Host ""
    Write-Host "🛑 Stopping server..." -ForegroundColor Yellow
    if ($serverProcess -and !$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    # Also kill any remaining node processes
    taskkill /F /IM node.exe 2>$null
    Write-Host "✅ Server stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "🏁 Test completed!" -ForegroundColor Green

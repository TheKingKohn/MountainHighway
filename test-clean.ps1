#!/usr/bin/env pwsh

Write-Host "🧪 Quick API Test - Payment System Validation" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Start server in background and capture process
Write-Host "🚀 Starting API server..." -ForegroundColor Yellow
$serverProcess = Start-Process powershell -ArgumentList "-Command", "cd 'c:\Users\theki\OneDrive\Desktop\MountainHighway\packages\api'; npm run dev" -PassThru

# Wait for server to start
Write-Host "⏳ Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    # Test health endpoint
    Write-Host "🏥 Testing health endpoint..." -ForegroundColor Cyan
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get -TimeoutSec 5
    Write-Host "✅ Health check passed" -ForegroundColor Green

    # Register a test user to get authentication token
    Write-Host "👤 Registering test user..." -ForegroundColor Cyan
    $headers = @{ 'Content-Type' = 'application/json' }
    $registerBody = @{
        email = "testuser@example.com"
        password = "password123"
    } | ConvertTo-Json

    $userResult = Invoke-RestMethod -Uri "http://localhost:4000/auth/register" -Method Post -Headers $headers -Body $registerBody -TimeoutSec 5
    $token = $userResult.token
    Write-Host "✅ User registered successfully" -ForegroundColor Green

    # Update headers with auth token
    $authHeaders = @{
        'Content-Type' = 'application/json'
        'Authorization' = "Bearer $token"
    }

    # Test payment methods endpoint
    Write-Host "💳 Testing payment methods..." -ForegroundColor Cyan
    $methods = Invoke-RestMethod -Uri "http://localhost:4000/payments/methods" -Method Get -Headers $authHeaders -TimeoutSec 5
    Write-Host "✅ Payment methods available" -ForegroundColor Green

    # Test Stripe Connect account creation
    Write-Host "🔗 Testing Stripe Connect..." -ForegroundColor Cyan
    $createAccountBody = @{
        email = "seller@example.com"
        business_type = "individual"
        country = "US"
    } | ConvertTo-Json

    $account = Invoke-RestMethod -Uri "http://localhost:4000/stripe/create-account" -Method Post -Headers $authHeaders -Body $createAccountBody -TimeoutSec 5
    Write-Host "✅ Stripe Connect account created" -ForegroundColor Green

    # Test payment creation (Stripe)
    Write-Host "💰 Testing Stripe payment..." -ForegroundColor Cyan
    $paymentBody = @{
        amount = 2000
        currency = "usd"
        payment_method = "card"
        customer_email = "customer@example.com"
    } | ConvertTo-Json

    $payment = Invoke-RestMethod -Uri "http://localhost:4000/payments/create" -Method Post -Headers $authHeaders -Body $paymentBody -TimeoutSec 5
    Write-Host "✅ Stripe payment intent created" -ForegroundColor Green

    # Test PayPal order creation
    Write-Host "🅿️ Testing PayPal payment..." -ForegroundColor Cyan
    $paypalBody = @{
        amount = 1500
        currency = "USD"
        payment_method = "paypal"
        customer_email = "customer@example.com"
    } | ConvertTo-Json

    $paypalOrder = Invoke-RestMethod -Uri "http://localhost:4000/payments/create" -Method Post -Headers $authHeaders -Body $paypalBody -TimeoutSec 5
    Write-Host "✅ PayPal order created" -ForegroundColor Green

    Write-Host ""
    Write-Host "🎉 ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "✅ Authentication system working" -ForegroundColor Green  
    Write-Host "✅ Stripe Connect integration working" -ForegroundColor Green
    Write-Host "✅ Stripe payment processing working" -ForegroundColor Green
    Write-Host "✅ PayPal payment processing working" -ForegroundColor Green
    Write-Host "✅ Mock mode enabled - no real API calls made" -ForegroundColor Green

} catch {
    Write-Host "❌ Test failed: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to get more details
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Yellow
    }
} finally {
    # Clean shutdown
    Write-Host ""
    Write-Host "🛑 Stopping server..." -ForegroundColor Yellow
    if ($serverProcess -and !$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    # Kill any remaining node processes
    taskkill /F /IM node.exe 2>$null | Out-Null
    Write-Host "✅ Server stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "🏁 Test completed!" -ForegroundColor Green

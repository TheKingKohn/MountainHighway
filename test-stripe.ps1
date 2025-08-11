# Test Stripe Connect API Endpoints
# First, register a user and login to get a token

Write-Host "=== Testing Stripe Connect API ===" -ForegroundColor Green

# Step 1: Register a test user
Write-Host "`n1. Registering test user..." -ForegroundColor Yellow
$registerBody = @{
    email = "seller@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
    Write-Host "✅ User registered successfully" -ForegroundColor Green
    $token = $registerResponse.token
} catch {
    Write-Host "❌ Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to login instead (user might already exist)
    Write-Host "`nTrying to login with existing user..." -ForegroundColor Yellow
    $loginBody = @{
        email = "seller@example.com"
        password = "password123"
    } | ConvertTo-Json
    
    try {
        $loginResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
        Write-Host "✅ Login successful" -ForegroundColor Green
        $token = $loginResponse.token
    } catch {
        Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

$headers = @{
    'Authorization' = "Bearer $token"
    'Content-Type' = 'application/json'
}

# Step 2: Check initial Stripe account status
Write-Host "`n2. Checking initial Stripe account status..." -ForegroundColor Yellow
try {
    $accountStatus = Invoke-RestMethod -Uri "http://localhost:4000/stripe/account" -Method Get -Headers $headers
    Write-Host "✅ Account status retrieved:" -ForegroundColor Green
    Write-Host "   Has Account: $($accountStatus.hasAccount)"
    Write-Host "   Account ID: $($accountStatus.accountId)"
    Write-Host "   Charges Enabled: $($accountStatus.chargesEnabled)"
    Write-Host "   Payouts Enabled: $($accountStatus.payoutsEnabled)"
} catch {
    Write-Host "❌ Failed to get account status: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 3: Create Stripe Connect account
Write-Host "`n3. Creating Stripe Connect account..." -ForegroundColor Yellow
try {
    $createAccountResponse = Invoke-RestMethod -Uri "http://localhost:4000/stripe/create-account" -Method Post -Headers $headers
    Write-Host "✅ Stripe account created:" -ForegroundColor Green
    Write-Host "   Account ID: $($createAccountResponse.accountId)"
    Write-Host "   Message: $($createAccountResponse.message)"
} catch {
    Write-Host "❌ Failed to create account: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response | ConvertTo-Json)" -ForegroundColor Red
}

# Step 4: Create account onboarding link
Write-Host "`n4. Creating account onboarding link..." -ForegroundColor Yellow
try {
    $accountLinkResponse = Invoke-RestMethod -Uri "http://localhost:4000/stripe/account-link" -Method Post -Headers $headers
    Write-Host "✅ Account link created:" -ForegroundColor Green
    Write-Host "   URL: $($accountLinkResponse.url)"
    Write-Host "   Expires At: $($accountLinkResponse.expiresAt)"
    
    # Open the onboarding URL in default browser
    Write-Host "`n🌐 Opening onboarding link in browser..." -ForegroundColor Cyan
    Start-Process $accountLinkResponse.url
} catch {
    Write-Host "❌ Failed to create account link: $($_.Exception.Message)" -ForegroundColor Red
}

# Step 5: Check account status again
Write-Host "`n5. Checking updated Stripe account status..." -ForegroundColor Yellow
try {
    $updatedAccountStatus = Invoke-RestMethod -Uri "http://localhost:4000/stripe/account" -Method Get -Headers $headers
    Write-Host "✅ Updated account status retrieved:" -ForegroundColor Green
    Write-Host "   Has Account: $($updatedAccountStatus.hasAccount)"
    Write-Host "   Account ID: $($updatedAccountStatus.accountId)"
    Write-Host "   Charges Enabled: $($updatedAccountStatus.chargesEnabled)"
    Write-Host "   Payouts Enabled: $($updatedAccountStatus.payoutsEnabled)"
    Write-Host "   Details Submitted: $($updatedAccountStatus.detailsSubmitted)"
    Write-Host "   Country: $($updatedAccountStatus.country)"
    Write-Host "   Default Currency: $($updatedAccountStatus.defaultCurrency)"
    
    if ($updatedAccountStatus.requirements.currentlyDue.Length -gt 0) {
        Write-Host "   Currently Due: $($updatedAccountStatus.requirements.currentlyDue -join ', ')" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to get updated account status: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Green
Write-Host "Note: The Stripe account is in test mode and won't process real payments." -ForegroundColor Cyan

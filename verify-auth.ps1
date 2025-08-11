# Comprehensive Auth Test Script
Write-Host "🧪 Starting comprehensive auth system verification..." -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "`n1. Testing API Health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health"
    if ($health.ok) {
        Write-Host "✅ API Health Check: PASSED" -ForegroundColor Green
    } else {
        Write-Host "❌ API Health Check: FAILED" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ API Health Check: CONNECTION FAILED" -ForegroundColor Red
    exit 1
}

# Test 2: User Registration
Write-Host "`n2. Testing User Registration..." -ForegroundColor Yellow
$testEmail = "verify-user-$(Get-Date -Format 'yyyyMMddHHmmss')@example.com"
$testPassword = "testpassword123"

$registerBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
    Write-Host "✅ User Registration: PASSED" -ForegroundColor Green
    Write-Host "   User ID: $($registerResponse.user.id)"
    Write-Host "   Email: $($registerResponse.user.email)"
    Write-Host "   Token Length: $($registerResponse.token.Length)"
    $registrationToken = $registerResponse.token
} catch {
    Write-Host "❌ User Registration: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 3: User Login
Write-Host "`n3. Testing User Login..." -ForegroundColor Yellow
$loginBody = @{
    email = $testEmail
    password = $testPassword
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    Write-Host "✅ User Login: PASSED" -ForegroundColor Green
    Write-Host "   User ID: $($loginResponse.user.id)"
    Write-Host "   Email: $($loginResponse.user.email)"
    Write-Host "   Token Length: $($loginResponse.token.Length)"
    $loginToken = $loginResponse.token
} catch {
    Write-Host "❌ User Login: FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 4: GET /me with valid token
Write-Host "`n4. Testing /me endpoint with valid token..." -ForegroundColor Yellow
$headers = @{
    'Authorization' = "Bearer $loginToken"
    'Content-Type' = 'application/json'
}

try {
    $meResponse = Invoke-RestMethod -Uri "http://localhost:4000/me" -Method Get -Headers $headers
    Write-Host "✅ GET /me (valid token): PASSED" -ForegroundColor Green
    Write-Host "   User ID: $($meResponse.id)"
    Write-Host "   Email: $($meResponse.email)"
    Write-Host "   Stripe Account ID: $($meResponse.stripeAccountId)"
} catch {
    Write-Host "❌ GET /me (valid token): FAILED" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 5: GET /me with invalid token
Write-Host "`n5. Testing /me endpoint with invalid token..." -ForegroundColor Yellow
$invalidHeaders = @{
    'Authorization' = "Bearer invalid.token.here"
    'Content-Type' = 'application/json'
}

try {
    $invalidResponse = Invoke-RestMethod -Uri "http://localhost:4000/me" -Method Get -Headers $invalidHeaders
    Write-Host "❌ GET /me (invalid token): FAILED - Should have rejected invalid token" -ForegroundColor Red
    exit 1
} catch {
    # This should fail - that's expected
    Write-Host "✅ GET /me (invalid token): PASSED - Correctly rejected invalid token" -ForegroundColor Green
}

# Test 6: GET /me without token
Write-Host "`n6. Testing /me endpoint without token..." -ForegroundColor Yellow
try {
    $noTokenResponse = Invoke-RestMethod -Uri "http://localhost:4000/me" -Method Get
    Write-Host "❌ GET /me (no token): FAILED - Should have required token" -ForegroundColor Red
    exit 1
} catch {
    # This should fail - that's expected
    Write-Host "✅ GET /me (no token): PASSED - Correctly required authentication" -ForegroundColor Green
}

# Test 7: Duplicate registration
Write-Host "`n7. Testing duplicate user registration..." -ForegroundColor Yellow
try {
    $duplicateResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
    Write-Host "❌ Duplicate Registration: FAILED - Should have rejected duplicate email" -ForegroundColor Red
    exit 1
} catch {
    # This should fail - that's expected
    Write-Host "✅ Duplicate Registration: PASSED - Correctly rejected duplicate email" -ForegroundColor Green
}

# Test 8: Invalid login credentials
Write-Host "`n8. Testing invalid login credentials..." -ForegroundColor Yellow
$invalidLoginBody = @{
    email = $testEmail
    password = "wrongpassword"
} | ConvertTo-Json

try {
    $invalidLoginResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method Post -ContentType "application/json" -Body $invalidLoginBody
    Write-Host "❌ Invalid Login: FAILED - Should have rejected wrong password" -ForegroundColor Red
    exit 1
} catch {
    # This should fail - that's expected
    Write-Host "✅ Invalid Login: PASSED - Correctly rejected wrong password" -ForegroundColor Green
}

Write-Host "`n🎉 ALL AUTH TESTS PASSED!" -ForegroundColor Green
Write-Host "✅ Registration works correctly" -ForegroundColor Green
Write-Host "✅ Login works correctly" -ForegroundColor Green
Write-Host "✅ JWT authentication works correctly" -ForegroundColor Green
Write-Host "✅ Protected endpoints work correctly" -ForegroundColor Green
Write-Host "✅ Error handling works correctly" -ForegroundColor Green
Write-Host "`n🚀 AUTH SYSTEM IS READY FOR NEXT PHASE!" -ForegroundColor Cyan

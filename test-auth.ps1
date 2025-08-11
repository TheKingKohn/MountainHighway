# Test auth endpoints

# Test user registration
Write-Host "Testing user registration..."
$registerBody = @{
    email = "newuser@example.com"
    password = "password123"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/register" -Method Post -ContentType "application/json" -Body $registerBody
    Write-Host "✅ Registration successful!" -ForegroundColor Green
    Write-Host "User ID: $($registerResponse.user.id)"
    Write-Host "Email: $($registerResponse.user.email)"
    Write-Host "Token (first 20 chars): $($registerResponse.token.Substring(0, 20))..."
    
    # Store token for next test
    $token = $registerResponse.token
    
    # Test login with same credentials
    Write-Host "`nTesting user login..."
    $loginBody = @{
        email = "newuser@example.com"
        password = "password123"
    } | ConvertTo-Json
    
    $loginResponse = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    Write-Host "✅ Login successful!" -ForegroundColor Green
    $tokenMatch = if ($token -eq $loginResponse.token) { "Same token" } else { "Different token generated" }
    Write-Host "Token comparison: $tokenMatch"
    
    # Test /me endpoint
    Write-Host "`nTesting /me endpoint..."
    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json'
    }
    
    $meResponse = Invoke-RestMethod -Uri "http://localhost:4000/me" -Method Get -Headers $headers
    Write-Host "✅ /me endpoint successful!" -ForegroundColor Green
    Write-Host "User ID: $($meResponse.id)"
    Write-Host "Email: $($meResponse.email)"
    Write-Host "Stripe Account ID: $($meResponse.stripeAccountId)"
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Yellow
    }
}

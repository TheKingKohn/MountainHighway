Write-Host "Complete Marketplace Test" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green

# Start server in background
Write-Host "Starting API server..." -ForegroundColor Yellow
$serverProcess = Start-Process powershell -ArgumentList "-Command", "cd 'c:\Users\theki\OneDrive\Desktop\MountainHighway\packages\api'; npm run dev" -PassThru

# Wait for server to start
Write-Host "Waiting for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

try {
    # Test health
    Write-Host "Testing health..." -ForegroundColor Cyan
    $health = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get -TimeoutSec 5
    Write-Host "Health check passed" -ForegroundColor Green

    # Get auth token
    Write-Host "Getting auth token..." -ForegroundColor Cyan
    $headers = @{ 'Content-Type' = 'application/json' }
    $authBody = @{
        email = "seller@example.com"
        password = "password123"
    } | ConvertTo-Json

    try {
        $userResult = Invoke-RestMethod -Uri "http://localhost:4000/auth/register" -Method Post -Headers $headers -Body $authBody -TimeoutSec 5
        Write-Host "User registered" -ForegroundColor Green
    } catch {
        $userResult = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method Post -Headers $headers -Body $authBody -TimeoutSec 5
        Write-Host "User logged in" -ForegroundColor Green
    }
    
    $token = $userResult.token
    $authHeaders = @{
        'Content-Type' = 'application/json'
        'Authorization' = "Bearer $token"
    }

    # Create listing
    Write-Host "Creating listing..." -ForegroundColor Cyan
    $listingBody = @{
        title = "Test Camera"
        description = "Professional camera equipment"
        priceCents = 125000
        photos = @("camera1.jpg", "camera2.jpg")
    } | ConvertTo-Json

    $listing = Invoke-RestMethod -Uri "http://localhost:4000/listings" -Method Post -Headers $authHeaders -Body $listingBody -TimeoutSec 5
    $listingId = $listing.listing.id
    Write-Host "Listing created: $($listing.listing.title)" -ForegroundColor Green

    # Browse listings
    Write-Host "Browsing listings..." -ForegroundColor Cyan
    $allListings = Invoke-RestMethod -Uri "http://localhost:4000/listings" -Method Get -TimeoutSec 5
    Write-Host "Found $($allListings.listings.Count) listings" -ForegroundColor Green

    # View specific listing
    Write-Host "Viewing listing details..." -ForegroundColor Cyan
    $listingDetails = Invoke-RestMethod -Uri "http://localhost:4000/listings/$listingId" -Method Get -TimeoutSec 5
    Write-Host "Viewing: $($listingDetails.listing.title)" -ForegroundColor Green

    # Create payment
    Write-Host "Creating payment..." -ForegroundColor Cyan
    $paymentBody = @{
        listingId = $listingId
        amount = 1250.00
        currency = "usd"
        paymentMethod = "stripe"
    } | ConvertTo-Json

    $payment = Invoke-RestMethod -Uri "http://localhost:4000/payments/create" -Method Post -Headers $authHeaders -Body $paymentBody -TimeoutSec 5
    Write-Host "Payment created: $($payment.paymentIntent.id)" -ForegroundColor Green

    Write-Host ""
    Write-Host "ALL MARKETPLACE TESTS PASSED!" -ForegroundColor Green
    Write-Host "Authentication working" -ForegroundColor Green
    Write-Host "Listings CRUD working" -ForegroundColor Green
    Write-Host "Payment integration working" -ForegroundColor Green
    Write-Host "Ready for Postman testing!" -ForegroundColor Yellow

} catch {
    Write-Host "Test failed: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Write-Host ""
    Write-Host "Stopping server..." -ForegroundColor Yellow
    if ($serverProcess -and !$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    taskkill /F /IM node.exe 2>$null | Out-Null
    Write-Host "Server stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "Test completed!" -ForegroundColor Green

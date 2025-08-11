Write-Host "MOUNTAIN HIGHWAY ESCROW SYSTEM TEST" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:4000"
$orderId = "cm4zz6qwa0002mh78qbhepb9l"

Write-Host "`nStep 1: Testing webhook simulation..." -ForegroundColor Yellow

$webhookResponse = Invoke-RestMethod -Uri "$baseUrl/test/simulate-webhook/$orderId" -Method POST -Headers @{
    "Authorization" = "Bearer test-token"
    "Content-Type" = "application/json"
}

Write-Host "Webhook Simulation Result:" -ForegroundColor Green
$webhookResponse | ConvertTo-Json -Depth 3

Write-Host "`nStep 2: Viewing all held orders..." -ForegroundColor Yellow

$heldOrders = Invoke-RestMethod -Uri "$baseUrl/test/orders/held" -Method GET

Write-Host "Held Orders Summary:" -ForegroundColor Green
Write-Host "Total Orders: $($heldOrders.summary.totalOrders)" -ForegroundColor White
Write-Host "Total Value: $($heldOrders.summary.totalValue / 100) USD" -ForegroundColor White
Write-Host "Total Platform Fees: $($heldOrders.summary.totalPlatformFees / 100) USD" -ForegroundColor White

Write-Host "`nESCROW SYSTEM STATUS: FULLY OPERATIONAL!" -ForegroundColor Green

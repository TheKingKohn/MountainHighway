# Simple messaging test
Write-Host "Testing messaging endpoints..." -ForegroundColor Cyan

# Just test the health endpoint first
$health = Invoke-RestMethod -Uri "http://localhost:4000/health" -Method Get
Write-Host "Health check: $($health.ok)" -ForegroundColor Green

Write-Host "Messaging endpoints should be available at:" -ForegroundColor White
Write-Host "- POST /orders/:orderId/messages" -ForegroundColor Gray
Write-Host "- GET /orders/:orderId/messages" -ForegroundColor Gray

# Script to test Error Rate in Grafana
# Generate many error requests to see chart changes

Write-Host "Testing Error Rate - Generating errors..." -ForegroundColor Yellow
Write-Host "This will take about 30 seconds..." -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://food-delivery.local"
$totalRequests = 100

for ($i = 1; $i -le $totalRequests; $i++) {
    # Mix của nhiều loại lỗi
    
    # 404 - Not Found (40% của requests)
    if ($i % 5 -eq 0) {
        Invoke-WebRequest -Uri "$baseUrl/api/auth/invalid-endpoint-$i" -Method GET -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
        Invoke-WebRequest -Uri "$baseUrl/api/orders/nonexistent-$i" -Method GET -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
    }
    
    # 401 - Unauthorized (30% của requests)
    if ($i % 3 -eq 0) {
        $body = @{} | ConvertTo-Json
        Invoke-WebRequest -Uri "$baseUrl/api/orders" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
    }
    
    # 400 - Bad Request (20% của requests)
    if ($i % 4 -eq 0) {
        $badData = @{
            email = "invalid-email"
            password = "123"
        } | ConvertTo-Json
        Invoke-WebRequest -Uri "$baseUrl/api/auth/register" -Method POST -Body $badData -ContentType "application/json" -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
    }
    
    # 404 - Restaurant service
    if ($i % 2 -eq 0) {
        Invoke-WebRequest -Uri "$baseUrl/api/restaurant/bad-endpoint-$i" -Method GET -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
    }
    
    # 404 - Payment service
    if ($i % 7 -eq 0) {
        Invoke-WebRequest -Uri "$baseUrl/api/payment/wrong-path-$i" -Method GET -UseBasicParsing -ErrorAction SilentlyContinue | Out-Null
    }
    
    # Progress bar
    $percent = [math]::Round(($i / $totalRequests) * 100)
    Write-Progress -Activity "Generating error requests" -Status "$i / $totalRequests requests sent" -PercentComplete $percent
    
    # Delay nhỏ để không overwhelm services
    Start-Sleep -Milliseconds 200
}

Write-Progress -Activity "Generating error requests" -Completed

Write-Host ""
Write-Host "Done! Generated $totalRequests error requests" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "   1. Open Grafana: http://localhost:30300" -ForegroundColor White
Write-Host "   2. Go to 'Golden Signals - Food Delivery Services' dashboard" -ForegroundColor White
Write-Host "   3. Check 'Errors (Error Rate %)' panel - will see increase!" -ForegroundColor White
Write-Host "   4. Click 'Last 1 hour' -> select 'Last 5 minutes' for better view" -ForegroundColor White
Write-Host ""
Write-Host "Tip: Error rate will be highest in the last 1-2 minutes" -ForegroundColor Yellow

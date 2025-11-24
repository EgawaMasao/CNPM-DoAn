# Simple script to push test logs to Loki

param(
    [string]$LokiUrl = "https://furthermore-cylindraceous-amelie.ngrok-free.dev",
    [string]$LokiUsername = "admin",
    [string]$LokiPassword = "admin123"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Pushing logs to Loki" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Test Loki connection
Write-Host "Testing Loki connection..." -ForegroundColor Yellow
$auth = "$LokiUsername`:$LokiPassword"
$base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($auth))

try {
    $response = Invoke-WebRequest -Uri "$LokiUrl/ready" `
        -Method GET `
        -Headers @{
            "Authorization" = "Basic $base64Auth"
        } `
        -ErrorAction Stop
    Write-Host "✓ Loki is ready" -ForegroundColor Green
}
catch {
    Write-Host "✗ Cannot connect to Loki: $_" -ForegroundColor Red
    exit 1
}

# Sample log data
$sampleLogs = @(
    @{service="restaurant-service"; status="PASSED"; message="All tests passed"; runId="123456"},
    @{service="order-service"; status="FAILED"; message="Failed: test case xyz"; runId="123456"},
    @{service="payment-service"; status="PASSED"; message="All tests passed"; runId="123456"},
    @{service="auth-service"; status="PASSED"; message="All tests passed"; runId="123456"},
    @{service="frontend"; status="PASSED"; message="All tests passed"; runId="123456"}
)

# Push each log entry
foreach ($log in $sampleLogs) {
    $timestamp = [int64]([datetime]::UtcNow.Ticks / 100)
    $logMessage = "Service: $($log.service) | Status: $($log.status) | $($log.message)"
    $logJson = $logMessage | ConvertTo-Json
    
    $payloadObj = @{
        streams = @(
            @{
                stream = @{
                    job = $log.service
                    status = $log.status
                    github_run = $log.runId
                }
                values = @(
                    @($timestamp.ToString(), $logJson)
                )
            }
        )
    }
    
    $payload = $payloadObj | ConvertTo-Json -Compress
    $lokiUri = "$LokiUrl/loki/api/v1/push"
    
    try {
        $response = Invoke-WebRequest -Uri $lokiUri `
            -Method POST `
            -Headers @{"Content-Type" = "application/json"; "Authorization" = "Basic $base64Auth"} `
            -Body $payload `
            -ErrorAction Stop
        
        Write-Host "✓ Pushed $($log.service) logs" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Failed to push $($log.service): $_" -ForegroundColor Red
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Done! Check Grafana dashboard" -ForegroundColor Green
Write-Host "http://localhost:30300/" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

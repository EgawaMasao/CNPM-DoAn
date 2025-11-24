# Script to run tests and push logs to Loki
# Usage: .\run-tests-to-loki.ps1

param(
    [string]$LokiUrl = "http://172.21.0.2:3100",
    [string]$LokiUsername = "admin",
    [string]$LokiPassword = "admin123"
)

# Color output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error-Custom { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }

# Services to test
$services = @(
    @{name="restaurant-service"; path="./backend/restaurant-service"},
    @{name="order-service"; path="./backend/order-service"},
    @{name="payment-service"; path="./backend/payment-service"},
    @{name="auth-service"; path="./backend/auth-service"},
    @{name="frontend"; path="./frontend"}
)

# Function to push logs to Loki
function Push-ToLoki {
    param(
        [string]$ServiceName,
        [string]$LogContent,
        [string]$Status
    )
    
    $timestamp = [int64]([datetime]::UtcNow.Ticks / 100)
    $logJson = $LogContent | ConvertTo-Json -Compress
    
    $payload = @{
        streams = @(
            @{
                stream = @{
                    service = $ServiceName
                    status = $Status
                    host = "local-test"
                }
                values = @(
                    @($timestamp.ToString(), $logJson)
                )
            }
        )
    } | ConvertTo-Json -Compress
    
    Write-Info "Pushing $ServiceName logs to Loki..."
    
    $auth = "$LokiUsername`:$LokiPassword"
    $base64Auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($auth))
    
    try {
        $response = Invoke-WebRequest -Uri "$LokiUrl/loki/api/v1/push" `
            -Method POST `
            -Headers @{
                "Content-Type" = "application/json"
                "Authorization" = "Basic $base64Auth"
            } `
            -Body $payload `
            -ErrorAction Stop
        
        Write-Success "✓ $ServiceName logs pushed successfully"
    }
    catch {
        Write-Error-Custom "✗ Failed to push $ServiceName logs: $_"
    }
}

# Main execution
Write-Info "=========================================="
Write-Info "Running Tests and Pushing to Loki"
Write-Info "=========================================="
Write-Info "Loki URL: $LokiUrl"
Write-Info "==========================================`n"

$allResults = @()

foreach ($service in $services) {
    Write-Info "`n>>> Testing $($service.name)..."
    
    $servicePath = $service.path
    
    if (-not (Test-Path $servicePath)) {
        Write-Error-Custom "✗ Service path not found: $servicePath"
        continue
    }
    
    # Install dependencies if needed
    if (-not (Test-Path "$servicePath/node_modules")) {
        Write-Info "Installing dependencies for $($service.name)..."
        Push-Location $servicePath
        npm install
        Pop-Location
    }
    
    # Run tests
    $logFile = "$servicePath/test-output.log"
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    Push-Location $servicePath
    
    # Run tests and capture output
    Write-Info "Running npm test for $($service.name)..."
    $output = npm test 2>&1 | Tee-Object -FilePath $logFile
    $exitCode = $LASTEXITCODE
    
    Pop-Location
    
    # Determine status
    $status = if ($exitCode -eq 0) { "PASSED" } else { "FAILED" }
    
    # Create log entry
    $logEntry = @{
        service = $service.name
        status = $status
        timestamp = $timestamp
        exitCode = $exitCode
        logContent = $output
    }
    
    $allResults += $logEntry
    
    # Push to Loki
    $logContent = "Service: $($service.name)`nStatus: $status`nTimestamp: $timestamp`nExit Code: $exitCode`n`nLog Output:`n$output"
    Push-ToLoki -ServiceName $service.name -LogContent $logContent -Status $status
    
    # Display result
    if ($status -eq "PASSED") {
        Write-Success "✓ $($service.name) PASSED"
    }
    else {
        Write-Error-Custom "✗ $($service.name) FAILED (exit code: $exitCode)"
    }
}

# Summary
Write-Info "`n=========================================="
Write-Info "Test Summary"
Write-Info "=========================================="

$passed = ($allResults | Where-Object { $_.status -eq "PASSED" }).Count
$failed = ($allResults | Where-Object { $_.status -eq "FAILED" }).Count

Write-Success "Passed: $passed"
Write-Error-Custom "Failed: $failed"
Write-Info "Total: $($allResults.Count)"

Write-Info "`n=========================================="
Write-Info "Logs pushed to Loki!"
Write-Info "View in Grafana: http://localhost:30300/"
Write-Info "=========================================="

# Return summary
$allResults

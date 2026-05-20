# Test endpoint script for PrepForge backend

$baseUrl = "http://localhost:5000"

# 1. Login to get token
Write-Host "1️⃣  Testing LOGIN endpoint..."
$loginBody = @{
    email = "rubans082005@gmail.com"
    password = "Test@1234"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginBody `
        -ErrorAction Stop

    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.data.token
    
    if ($token) {
        Write-Host "✅ Login successful! Token: $($token.Substring(0, 20))..."
    } else {
        Write-Host "❌ No token in response"
        Write-Host $loginData | ConvertTo-Json
        exit
    }
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)"
    exit
}

# 2. Test LeetCode sync
Write-Host "`n2️⃣  Testing LEETCODE SYNC endpoint..."
$syncBody = @{
    leetcodeUsername = "S_RUBAN"
} | ConvertTo-Json

try {
    $syncResponse = Invoke-WebRequest -Uri "$baseUrl/api/leetcode/sync" `
        -Method POST `
        -ContentType "application/json" `
        -Body $syncBody `
        -Headers @{ Authorization = "Bearer $token" } `
        -ErrorAction Stop

    $syncData = $syncResponse.Content | ConvertFrom-Json
    Write-Host "✅ LeetCode Sync Response:"
    Write-Host ($syncData | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ LeetCode sync failed: $($_.Exception.Message)"
    $errorContent = $_.Exception.Response.Content | ConvertFrom-Json
    Write-Host $errorContent | ConvertTo-Json
}

# 3. Test get stats
Write-Host "`n3️⃣  Testing GET STATS endpoint..."
try {
    $statsResponse = Invoke-WebRequest -Uri "$baseUrl/api/leetcode/stats" `
        -Method GET `
        -Headers @{ Authorization = "Bearer $token" } `
        -ErrorAction Stop

    $statsData = $statsResponse.Content | ConvertFrom-Json
    Write-Host "✅ Stats Response:"
    Write-Host ($statsData | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ Get stats failed: $($_.Exception.Message)"
}

Write-Host "`n✨ Testing complete!"

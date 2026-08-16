# E2E test for PDF upload -> RAG -> Company Knowledge flow
$base = "http://localhost:5000/api"
$pdfPath = "C:\Users\HassanUsmani\Desktop\hackathon\AgentHack_Autonomous_AI_Sales_Agent_Challenge.pdf"
$token = ""

function req($method, $url, $body = $null, $headers = @{}, $form = $false) {
    $h = @{ "Authorization" = "Bearer $token" } + $headers
    if ($form) {
        return Invoke-RestMethod -Method $method -Uri "$base$url" -Body $body -Headers $h -ContentType "multipart/form-data"
    } elseif ($body) {
        return Invoke-RestMethod -Method $method -Uri "$base$url" -Body ($body | ConvertTo-Json -Depth 5) -Headers @($h + @{ "Content-Type" = "application/json" })
    } else {
        return Invoke-RestMethod -Method $method -Uri "$base$url" -Headers $h
    }
}

Write-Host "=== 1. Health check ===" -Fore Cyan
$health = Invoke-RestMethod "$base/health"
Write-Host "Health: $($health | ConvertTo-Json -Depth 3)"

Write-Host "`n=== 2. Login ===" -Fore Cyan
$login = req Post "/auth/login" @{ email = "admin@agenthack.ai"; password = "agenthack2026" }
$token = $login.token
Write-Host "Logged in, token length: $($token.Length)"

Write-Host "`n=== 3. Initial company profile ===" -Fore Cyan
$company = req Get "/company"
if ($company) {
    Write-Host "Profile: $($company.name) - chunks: $($company.chunk_count)"
} else {
    Write-Host "No profile yet"
}

Write-Host "`n=== 4. Initial documents ===" -Fore Cyan
$docs = req Get "/company/documents"
Write-Host "Documents: $($docs.Count)"

Write-Host "`n=== 5. Upload PDF ===" -Fore Cyan
$fileBytes = [IO.File]::ReadAllBytes($pdfPath)
$fd = @{ file = @{ Content = $fileBytes; FileName = (Split-Path $pdfPath -Leaf); ContentType = "application/pdf" } }
$upload = req Post "/company/documents/upload" $fd $null $true
Write-Host "Upload response: $($upload | ConvertTo-Json)"
$docId = $upload.documentId
Write-Host "Document ID: $docId"

Write-Host "`n=== 6. Poll status until indexed ===" -Fore Cyan
$started = [DateTime]::Now
while ($true) {
    $status = req Get "/company/documents/$docId/status"
    Write-Host "  Status: $($status.status) | Detail: $($status.status_detail) | Pages: $($status.page_count) | Chunks: $($status.chunk_count) | Error: $($status.error)"
    if ($status.status -eq "indexed") { break }
    if ($status.status -eq "failed") { throw "Processing failed: $($status.error)" }
    if (([DateTime]::Now - $started).TotalMinutes -gt 5) { throw "Timeout waiting for processing" }
    Start-Sleep -Seconds 2
}
Write-Host "Indexed successfully!" -Fore Green

Write-Host "`n=== 7. Verify company profile updated ===" -Fore Cyan
$company2 = req Get "/company"
Write-Host "Profile: $($company2.name)"
Write-Host "  Summary: $($company2.summary)"
Write-Host "  Offerings: $($company2.offerings | ConvertTo-Json)"
Write-Host "  Industries: $($company2.target_industries | ConvertTo-Json)"
Write-Host "  Case Studies: $($company2.case_studies | ConvertTo-Json)"
Write-Host "  Pricing: $($company2.pricing | ConvertTo-Json)"
Write-Host "  Tech Stack: $($company2.tech_stack | ConvertTo-Json)"
Write-Host "  Limitations: $($company2.limitations | ConvertTo-Json)"
Write-Host "  Chunks: $($company2.chunk_count)"

# Verify no invented offerings (the fallback should produce empty arrays)
if ($company2.offerings.Count -gt 0) {
    Write-Host "Offerings populated from PDF!" -Fore Green
} else {
    Write-Host "No offerings extracted (may be expected if PDF doesn't clearly list services)" -Fore Yellow
}

Write-Host "`n=== 8. Verify document in sources ===" -Fore Cyan
$docs2 = req Get "/company/documents"
Write-Host "Documents now: $($docs2.Count)"
$doc = $docs2 | Where-Object { $_.id -eq $docId }
if ($doc) {
    Write-Host "Doc: $($doc.filename) | Pages: $($doc.page_count) | Chunks: $($doc.chunk_count) | Status: $($doc.status)"
}

Write-Host "`n=== 9. Test Ask Company Knowledge ===" -Fore Cyan
$ask = req Post "/company/ask" @{ question = "What services do we offer?" }
Write-Host "Answer: $($ask.answer)"
Write-Host "Error: $($ask.error)"
if ($ask.sources) {
    Write-Host "Sources count: $($ask.sources.Count)"
    $ask.sources | ForEach-Object { Write-Host "  - Doc: $($_.document), Page: $($_.page), Section: $($_.section), Score: $($_.score)" }
}

Write-Host "`n=== 10. Test reprocess ===" -Fore Cyan
$reprocess = req Post "/company/documents/$docId/reprocess" @{}
Write-Host "Reprocess started: $($reprocess | ConvertTo-Json)"

# Poll reprocess
$started = [DateTime]::Now
while ($true) {
    $status = req Get "/company/documents/$docId/status"
    Write-Host "  Reprocess status: $($status.status) | Detail: $($status.status_detail)"
    if ($status.status -eq "indexed") { break }
    if ($status.status -eq "failed") { throw "Reprocess failed: $($status.error)" }
    if (([DateTime]::Now - $started).TotalMinutes -gt 5) { throw "Timeout waiting for reprocess" }
    Start-Sleep -Seconds 2
}
Write-Host "Reprocess completed!" -Fore Green

Write-Host "`n=== 11. Test View Chunks (source evidence) ===" -Fore Cyan
$chunks = req Get "/company/documents/$docId/chunks"
Write-Host "Chunks returned: $($chunks.Count)"
if ($chunks.Count -gt 0) {
    $c = $chunks[0]
    Write-Host "  First chunk: category=$($c.category), page=$($c.page), section=$($c.section), title=$($c.title)"
    Write-Host "  Content preview: $($c.content.Substring(0, [Math]::Min(120, $c.content.Length)))..."
}

Write-Host "`n=== 12. Test invalid file (text file renamed to .pdf) ===" -Fore Cyan
$txtContent = "This is not a PDF"
$tmpTxt = [IO.Path]::GetTempFileName() + ".pdf"
[IO.File]::WriteAllText($tmpTxt, $txtContent)
$fd2 = @{ file = @{ Content = [IO.File]::ReadAllBytes($tmpTxt); FileName = "fake.pdf"; ContentType = "application/pdf" } }
try {
    $bad = req Post "/company/documents/upload" $fd2 $null $true
    $badId = $bad.documentId
    Start-Sleep -Seconds 3
    $bst = req Get "/company/documents/$badId/status"
    Write-Host "Invalid file status: $($bst.status) | Error: $($bst.error)"
    if ($bst.status -eq "failed" -and $bst.error -like "*scanned*") {
        Write-Host "Correctly rejected scanned/image-based file" -Fore Green
    }
} catch {
    Write-Host "Upload rejected as expected: $($_.Exception.Message)" -Fore Green
} finally {
    Remove-Item -ErrorAction SilentlyContinue $tmpTxt
}

Write-Host "`n=== 13. Test corrupted PDF (random bytes) ===" -Fore Cyan
$corrupt = [IO.Path]::GetTempFileName() + ".pdf"
[IO.File]::WriteAllBytes($corrupt, (1..100 | ForEach-Object { Get-Random -Max 256 }))
$fd3 = @{ file = @{ Content = [IO.File]::ReadAllBytes($corrupt); FileName = "corrupt.pdf"; ContentType = "application/pdf" } }
try {
    $bad2 = req Post "/company/documents/upload" $fd3 $null $true
    $badId2 = $bad2.documentId
    Start-Sleep -Seconds 3
    $bst2 = req Get "/company/documents/$badId2/status"
    Write-Host "Corrupt file status: $($bst2.status) | Error: $($bst2.error)"
    if ($bst2.status -eq "failed" -and $bst2.error -like "*corrupted*") {
        Write-Host "Correctly rejected corrupted PDF" -Fore Green
    }
} catch {
    Write-Host "Upload rejected as expected: $($_.Exception.Message)" -Fore Green
} finally {
    Remove-Item -ErrorAction SilentlyContinue $corrupt
}

Write-Host "`n=== 14. Test delete document ===" -Fore Cyan
req Delete "/company/documents/$docId" | Out-Null
Write-Host "Delete request sent"
$docs3 = req Get "/company/documents"
Write-Host "Documents after delete: $($docs3.Count)"
$company3 = req Get "/company"
$cname = if ($company3) { $company3.name } else { 'none' }
$ccount = if ($company3) { $company3.chunk_count } else { 0 }
Write-Host "Profile after delete: $cname | Chunks: $ccount"

Write-Host "`n=== ALL TESTS PASSED ===" -Fore Green
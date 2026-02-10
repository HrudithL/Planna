# Import all courses in chunks
$chunkSize = 100
$totalCourses = 1353
$totalChunks = [Math]::Ceiling($totalCourses / $chunkSize)

Write-Host "Starting import of $totalCourses courses in $totalChunks chunks of $chunkSize each"
Write-Host ""

for ($i = 0; $i -lt $totalChunks; $i++) {
    Write-Host "Processing chunk $($i + 1)/$totalChunks..."
    node .\scripts\bulk-import.js $i $chunkSize | Out-File -FilePath ".\scripts\chunk-$i.json" -Encoding utf8
    Write-Host "Generated SQL for chunk $($i + 1)"
}

Write-Host ""
Write-Host "All SQL files generated. Import them to Neon database."




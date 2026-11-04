param([int]$DurationSeconds = 20)
$ErrorActionPreference = 'Stop'
$rootProcesses = @(Get-CimInstance Win32_Process -Filter "Name = 'ayori-compare.exe'")
if ($rootProcesses.Count -ne 1) { throw 'Run exactly one Ayori Compare instance.' }
$rootId = [int]$rootProcesses[0].ProcessId
$samples = @()
$timer = [Diagnostics.Stopwatch]::StartNew()
while ($timer.Elapsed.TotalSeconds -lt $DurationSeconds) {
    $all = Get-CimInstance Win32_Process
    $ids = [Collections.Generic.HashSet[int]]::new()
    [void]$ids.Add($rootId)
    do {
        $oldCount = $ids.Count
        foreach ($process in $all) {
            if ($ids.Contains([int]$process.ParentProcessId)) { [void]$ids.Add([int]$process.ProcessId) }
        }
    } while ($ids.Count -gt $oldCount)
    $processes = @(Get-Process -Id @($ids) -ErrorAction SilentlyContinue)
    $gpu = @(Get-Counter '\GPU Process Memory(*)\Dedicated Usage','\GPU Process Memory(*)\Shared Usage' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CounterSamples | Where-Object {
        $_.InstanceName -match '^pid_(\d+)_' -and $ids.Contains([int]$Matches[1])
    })
    $samples += [pscustomobject]@{
        seconds = [Math]::Round($timer.Elapsed.TotalSeconds,2)
        privateBytes = ($processes | Measure-Object -Property PrivateMemorySize64 -Sum).Sum
        workingSetBytes = ($processes | Measure-Object -Property WorkingSet64 -Sum).Sum
        gpuDedicatedBytes = if ($gpu.Count) { ($gpu | Where-Object {$_.Path -like '*\dedicated usage'} | Measure-Object -Property CookedValue -Sum).Sum } else { $null }
        gpuSharedBytes = if ($gpu.Count) { ($gpu | Where-Object {$_.Path -like '*\shared usage'} | Measure-Object -Property CookedValue -Sum).Sum } else { $null }
        processCount = $processes.Count
    }
    Start-Sleep -Milliseconds 250
}
$result = [pscustomobject]@{
    note = 'Sampled aggregate process-tree memory; working sets can double-count shared pages; GPU counters may include driver pools. Not a guaranteed instantaneous peak.'
    samples = $samples
    peakPrivateBytes = ($samples | Measure-Object privateBytes -Maximum).Maximum
    peakWorkingSetBytes = ($samples | Measure-Object workingSetBytes -Maximum).Maximum
    peakGpuDedicatedBytes = ($samples | Measure-Object gpuDedicatedBytes -Maximum).Maximum
    peakGpuSharedBytes = ($samples | Measure-Object gpuSharedBytes -Maximum).Maximum
}
$result | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 local-fixtures/memory-samples.json
$result | Select-Object note,peakPrivateBytes,peakWorkingSetBytes,peakGpuDedicatedBytes,peakGpuSharedBytes | ConvertTo-Json

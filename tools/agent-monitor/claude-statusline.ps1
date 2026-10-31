# OCRE-075 - Claude Code statusLine: store *only* quota percentages and reset epochs.
# No model text, session IDs, local paths, credentials or account metadata persist.
$ErrorActionPreference = 'Stop'
try {
    $raw = [Console]::In.ReadToEnd()
    if (-not $raw -or $raw.Length -gt 131072) { throw 'Invalid payload size' }
    $data = $raw | ConvertFrom-Json
    $limits = $data.rate_limits
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $clean = @{}
    foreach ($name in @('five_hour', 'seven_day')) {
        $window = $null
        if ($limits) { $window = $limits.$name }
        if (-not $window) { continue }
        $used = $window.used_percentage
        $reset = $window.resets_at
        if ($null -eq $used -or $null -eq $reset) { continue }
        if ($used -is [bool] -or $reset -is [bool]) { continue }
        try {
            $u = [double]$used
            $r = [double]$reset
        } catch { continue }
        if ([double]::IsNaN($u) -or [double]::IsInfinity($u) -or
            [double]::IsNaN($r) -or [double]::IsInfinity($r) -or
            $u -lt 0 -or $u -gt 100 -or $r -le $now -or
            $r -gt ($now + 1209600)) { continue }
        $clean[$name] = @{ used_percentage = $u; resets_at = [long]$r }
    }
    if ($clean.Count -gt 0) {
        $targetDir = Join-Path $env:USERPROFILE '.ocre-os\agent-monitor'
        if (-not (Test-Path -LiteralPath $targetDir)) {
            [void](New-Item -ItemType Directory -Path $targetDir -Force)
        }
        $target = Join-Path $targetDir 'claude-usage.json'
        $tmp = Join-Path $targetDir ('claude-usage.' + [guid]::NewGuid().ToString('N') + '.tmp')
        $snapshot = @{
            schema = 'ocre-claude-usage-v1'
            runtime = 'windows_interop'
            source = 'claude_code_statusline'
            observed_at = $now
            windows = $clean
        } | ConvertTo-Json -Compress -Depth 6
        try {
            [System.IO.File]::WriteAllText($tmp, $snapshot, [System.Text.UTF8Encoding]::new($false))
            Move-Item -LiteralPath $tmp -Destination $target -Force
        } finally {
            if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
        }
    }
    $display = @()
    foreach ($name in @('five_hour', 'seven_day')) {
        if ($clean.ContainsKey($name)) {
            $label = if ($name -eq 'five_hour') { '5h' } else { '7d' }
            $display += ($label + ':' + [math]::Round($clean[$name].used_percentage) + '%')
        }
    }
    if ($display.Count) { Write-Output ('OCRE Claude | ' + ($display -join ' ')) }
    else { Write-Output 'OCRE Claude | cuota pendiente' }
} catch {
    # A status-line error must never expose incoming JSON or block Claude Code.
    Write-Output 'OCRE Claude | cuota desconocida'
}

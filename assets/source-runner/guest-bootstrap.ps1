# Fixed hard-disposable guest bootstrap (protocol v1).
# This file is also embedded by src/main/source-runtime.ts. It is packaged as
# an audit/debug reference; execution uses the embedded bytes, never a host
# mapped folder or a mutable checkout file.
$ErrorActionPreference = 'Stop'
$protocol = 1
$jobId = $args[0]
$nonce = $args[1]
$endpoint = $args[2]
$token = $args[3]
$headers = @{ 'X-Ding-Ding-Runner' = $token; 'X-Ding-Ding-Protocol' = "$protocol" }
function Send-Runner($route, $body) {
  Invoke-RestMethod -Method Post -Uri "$endpoint$route" -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 12 -Compress)
}
$hello = @{ protocolVersion = $protocol; jobId = $jobId; challengeNonce = $nonce; hostMounts = 0; credentialsInjected = $false; secretsInjected = $false; shellStringsAllowed = $false }
Send-Runner '/hello' $hello | Out-Null
$plan = Invoke-RestMethod -Method Get -Uri "$endpoint/plan/$jobId" -Headers $headers
if ($plan.protocolVersion -ne $protocol -or $plan.jobId -ne $jobId -or $plan.challengeNonce -ne $nonce -or $plan.policy.hostMounts -ne 0 -or $plan.policy.credentialsInjected -ne $false -or $plan.policy.secretsInjected -ne $false -or $plan.policy.shellStringsAllowed -ne $false) { throw 'Runner plan or policy binding was rejected.' }
$workspace = Join-Path $env:TEMP "ding-ding-$jobId"
New-Item -ItemType Directory -Force -Path $workspace | Out-Null
try {
  $archive = Join-Path $workspace 'source.zip'
  Invoke-WebRequest -Uri $plan.sourceArchiveUrl -OutFile $archive -UseBasicParsing
  if ((Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant() -ne $plan.sourceArchiveSha256) { throw 'Source archive SHA-256 did not match the reviewed plan.' }
  Expand-Archive -LiteralPath $archive -DestinationPath $workspace -Force
  Remove-Item -LiteralPath $archive -Force
  foreach ($step in $plan.steps) {
    if ($step.arguments -join ' ' -match '[;&|<>\r\n]') { throw 'Shell operators are not permitted in a reviewed step.' }
    Send-Runner '/event' @{ stream = 'progress'; state = 'running'; text = "Starting $($step.id)"; progress = 10 } | Out-Null
    $p = Start-Process -FilePath $step.executable -ArgumentList ([string[]]$step.arguments) -WorkingDirectory (Join-Path $workspace $step.cwd) -NoNewWindow -PassThru -Wait
    if ($p.ExitCode -ne 0) { throw "Reviewed step $($step.id) exited with code $($p.ExitCode)." }
  }
  $files = Get-ChildItem -LiteralPath $workspace -File -Recurse
  $manifest = @($files | ForEach-Object { $relative = $_.FullName.Substring($workspace.Length + 1).Replace('\','/'); @{ path = $relative; bytes = $_.Length; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant() } })
  Send-Runner '/outputs' @{ schemaVersion = 1; jobId = $jobId; files = $manifest } | Out-Null
  Send-Runner '/complete' @{ jobId = $jobId; ok = $true } | Out-Null
} finally {
  Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue
}

param(
  [Parameter(Mandatory = $true)]
  [string]$ToolsRoot
)

$ErrorActionPreference = 'Stop'
$version = '2.97.0'
$archiveName = "gh_${version}_windows_amd64.zip"
$releaseBase = "https://github.com/cli/cli/releases/download/v${version}"
$installRoot = Join-Path $ToolsRoot "gh-$version"
$executable = Join-Path $installRoot "bin\gh.exe"

if (-not (Test-Path -LiteralPath $executable)) {
  New-Item -ItemType Directory -Path $ToolsRoot -Force | Out-Null
  $archivePath = Join-Path $ToolsRoot $archiveName
  $checksumsPath = Join-Path $ToolsRoot "gh_${version}_checksums.txt"
  Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/$archiveName" -OutFile $archivePath
  Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/gh_${version}_checksums.txt" -OutFile $checksumsPath
  $checksumLine = Select-String -LiteralPath $checksumsPath -Pattern "^[a-fA-F0-9]{64}\s+$([regex]::Escape($archiveName))$" | Select-Object -First 1
  if (-not $checksumLine) { throw "The pinned GitHub CLI checksum file did not contain $archiveName." }
  $expected = ($checksumLine.Line -split '\s+')[0].ToLowerInvariant()
  $actual = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) { throw "GitHub CLI archive SHA-256 mismatch: expected $expected, received $actual." }
  $extractRoot = Join-Path $ToolsRoot "gh-$version-extracted"
  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot -Force
  $source = Get-ChildItem -LiteralPath $extractRoot -Recurse -Filter gh.exe | Select-Object -First 1
  if (-not $source) { throw 'The verified GitHub CLI archive did not contain gh.exe.' }
  New-Item -ItemType Directory -Path (Split-Path -Parent $executable) -Force | Out-Null
  Copy-Item -LiteralPath $source.FullName -Destination $executable
}

$reported = & $executable version 2>&1
if ($LASTEXITCODE -ne 0 -or $reported -notmatch "gh version $([regex]::Escape($version))") {
  throw "The job-local GitHub CLI did not report pinned version $version."
}

if ($env:GITHUB_PATH) { Split-Path -Parent $executable | Out-File -FilePath $env:GITHUB_PATH -Encoding utf8 -Append }
Write-Output "GitHub CLI $version ready at $executable"

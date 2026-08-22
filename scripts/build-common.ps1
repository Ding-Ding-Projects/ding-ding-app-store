$ErrorActionPreference = 'Stop'

function Get-RepositoryRoot {
  param([Parameter(Mandatory = $true)][string]$ScriptRoot)
  $root = (Resolve-Path -LiteralPath (Join-Path $ScriptRoot '..')).Path
  if (-not (Test-Path -LiteralPath (Join-Path $root 'package.json') -PathType Leaf)) {
    throw "The repository root does not contain package.json: $root"
  }
  return $root
}

function Refresh-ProcessPath {
  $machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = (($machinePath, $userPath, $env:Path) | Where-Object { $_ } | Select-Object -Unique) -join [IO.Path]::PathSeparator
}

function Get-NodeVersion {
  param([Parameter(Mandatory = $true)][string]$Executable)
  $output = @(& $Executable '--version' 2>&1)
  $exitCode = $LASTEXITCODE
  $line = if ($output.Count -gt 0) { ([string]$output[0]).Trim() } else { '' }
  if ($exitCode -ne 0 -or $line -notmatch '^v(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)') {
    throw "The Node executable did not report a usable semantic version: $line"
  }
  return [pscustomobject]@{ Text = $line; Major = [int]$Matches.major; Minor = [int]$Matches.minor; Patch = [int]$Matches.patch }
}

function Get-Sha256 {
  param([Parameter(Mandatory = $true)][string]$LiteralPath)
  if (-not (Test-Path -LiteralPath $LiteralPath -PathType Leaf)) {
    throw "Cannot hash a missing file: $LiteralPath"
  }
  $stream = $null
  $algorithm = $null
  try {
    $stream = [IO.File]::OpenRead($LiteralPath)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    return ([BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '')).ToLowerInvariant()
  }
  finally {
    if ($stream) { $stream.Dispose() }
    if ($algorithm) { $algorithm.Dispose() }
  }
}

function Invoke-BoundedDownload {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$Description
  )
  try {
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($curl) {
      & $curl.Source '--fail' '--location' '--silent' '--show-error' '--connect-timeout' '15' '--max-time' '120' '--output' $Destination $Uri
      if ($LASTEXITCODE -ne 0) { throw "$Description curl transfer exited with code $LASTEXITCODE." }
    } else {
      Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $Destination -TimeoutSec 120
    }
    $download = Get-Item -LiteralPath $Destination -ErrorAction Stop
    if ($download.PSIsContainer -or $download.Length -le 0) { throw "$Description returned an empty file." }
  }
  catch {
    Remove-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
    throw "$Description failed within the 120-second download limit: $($_.Exception.Message)"
  }
}

function Find-UsableNode {
  Refresh-ProcessPath
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if (-not $command) { return $null }
  $version = Get-NodeVersion -Executable $command.Source
  if ($version.Major -ne 22) { return $null }
  $npm = Join-Path (Split-Path -Parent $command.Source) 'npm.cmd'
  $npx = Join-Path (Split-Path -Parent $command.Source) 'npx.cmd'
  if (-not (Test-Path -LiteralPath $npm -PathType Leaf) -or -not (Test-Path -LiteralPath $npx -PathType Leaf)) { return $null }
  return [pscustomobject]@{ Node = $command.Source; Npm = $npm; Npx = $npx; Version = $version.Text; Source = 'existing' }
}

function Resolve-NodeToolchain {
  param([Parameter(Mandatory = $true)][string]$Root)
  $existing = Find-UsableNode
  if ($existing) { return $existing }

  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($winget) {
    Write-Output 'Node.js 22 was not ready; trying a user-scoped winget installation.'
    & $winget.Source install --id OpenJS.NodeJS.LTS --exact --scope user --silent --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -eq 0) {
      $installed = Find-UsableNode
      if ($installed) { return $installed }
    }
    Write-Output 'The user-scoped winget route did not expose Node.js 22; using the verified portable route.'
  }

  $version = '22.14.0'
  $toolRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'DingDingAppStore\toolchain'
  $portableRoot = Join-Path $toolRoot "node-v$version-win-x64"
  $node = Join-Path $portableRoot 'node.exe'
  $npm = Join-Path $portableRoot 'npm.cmd'
  $npx = Join-Path $portableRoot 'npx.cmd'
  if (-not (Test-Path -LiteralPath $node -PathType Leaf)) {
    New-Item -ItemType Directory -Path $toolRoot -Force | Out-Null
    $archive = Join-Path $toolRoot "node-v$version-win-x64.zip"
    $checksums = Join-Path $toolRoot "node-v$version-SHASUMS256.txt"
    $base = "https://nodejs.org/dist/v$version"
    Invoke-BoundedDownload -Uri "$base/node-v$version-win-x64.zip" -Destination $archive -Description 'Node.js portable archive download'
    Invoke-BoundedDownload -Uri "$base/SHASUMS256.txt" -Destination $checksums -Description 'Node.js checksum manifest download'
    $line = Select-String -LiteralPath $checksums -Pattern "node-v$version-win-x64\.zip\s*$" | Select-Object -First 1
    if (-not $line) { throw 'Node.js SHA-256 manifest did not contain the pinned Windows archive.' }
    $expected = (($line.Line -split '\s+')[0]).ToLowerInvariant()
    $actual = Get-Sha256 -LiteralPath $archive
    if ($actual -ne $expected) { throw "Node.js archive SHA-256 mismatch: expected $expected, received $actual." }
    $extractRoot = Join-Path $toolRoot 'extract'
    if (Test-Path -LiteralPath $extractRoot) { Remove-Item -LiteralPath $extractRoot -Recurse -Force }
    Expand-Archive -LiteralPath $archive -DestinationPath $extractRoot -Force
    $extracted = Join-Path $extractRoot "node-v$version-win-x64"
    if (-not (Test-Path -LiteralPath (Join-Path $extracted 'node.exe') -PathType Leaf)) { throw 'The verified Node.js archive did not contain its expected node.exe.' }
    if (Test-Path -LiteralPath $portableRoot) { Remove-Item -LiteralPath $portableRoot -Recurse -Force }
    Move-Item -LiteralPath $extracted -Destination $portableRoot
    Remove-Item -LiteralPath $extractRoot -Recurse -Force
    Remove-Item -LiteralPath $archive, $checksums -Force
  }
  if (-not (Test-Path -LiteralPath $npm -PathType Leaf) -or -not (Test-Path -LiteralPath $npx -PathType Leaf)) {
    throw "The portable Node.js toolchain is incomplete at $portableRoot."
  }
  $env:Path = "$portableRoot$([IO.Path]::PathSeparator)$env:Path"
  $resolved = Get-NodeVersion -Executable $node
  if ($resolved.Major -ne 22) { throw "The portable Node.js toolchain reported an unexpected version: $($resolved.Text)" }
  return [pscustomobject]@{ Node = $node; Npm = $npm; Npx = $npx; Version = $resolved.Text; Source = 'portable' }
}

function Invoke-CheckedTool {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Description,
    [Parameter(Mandatory = $true)][string]$WorkingDirectory
  )
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Description failed with exit code $LASTEXITCODE." }
}

function Remove-GeneratedDirectory {
  param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string]$Name)
  $rootFull = ([IO.Path]::GetFullPath($Root)).TrimEnd('\') + '\'
  $target = [IO.Path]::GetFullPath((Join-Path $Root $Name))
  if (-not $target.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to remove a generated path outside the checkout: $target" }
  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
}

function Get-SourceIdentity {
  param([Parameter(Mandatory = $true)][string]$Root)
  $commitOutput = @(& git -C $Root rev-parse HEAD 2>$null)
  $commitExitCode = $LASTEXITCODE
  $commit = if ($commitOutput.Count -gt 0) { ([string]$commitOutput[0]).Trim() } else { '' }
  if ($commitExitCode -ne 0 -or $commit -notmatch '^[0-9a-f]{40}$') { $commit = $null }
  $statusOutput = @(& git -C $Root status --porcelain 2>$null)
  $dirty = [bool](($statusOutput -join "`n").Trim())
  return [pscustomobject]@{ Commit = $commit; Dirty = $dirty }
}

function Invoke-ProjectBuild {
  param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)]$Tools)
  if (-not (Test-Path -LiteralPath (Join-Path $Root 'package-lock.json') -PathType Leaf)) { throw 'package-lock.json is required for a reproducible build.' }
  Remove-GeneratedDirectory -Root $Root -Name 'dist'
  Invoke-CheckedTool -Executable $Tools.Npm -Arguments @('ci') -Description 'npm ci' -WorkingDirectory $Root
  Invoke-CheckedTool -Executable $Tools.Npm -Arguments @('run', 'build') -Description 'npm run build' -WorkingDirectory $Root
  foreach ($relative in @('dist/renderer/index.html', 'dist/main/main.js', 'dist/preload/index.cjs')) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $relative) -PathType Leaf)) { throw "The build did not produce $relative." }
  }
}

function Assert-UnsignedSquirrelConfiguration {
  param([Parameter(Mandatory = $true)][string]$Root)
  $package = Get-Content -LiteralPath (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
  if ($package.build.win.forceCodeSigning -ne $false -or $package.build.win.signExecutable -ne $false -or $package.build.win.PSObject.Properties.Name -contains 'signAndEditExecutable') {
    throw 'The package configuration must disable signing while leaving executable resource editing enabled for branding.'
  }
  $targets = @($package.build.win.target | ForEach-Object { if ($_ -is [string]) { $_ } else { $_.target } })
  if ($targets -notcontains 'squirrel') { throw 'The installer path must use the Squirrel.Windows target.' }
}

function Read-PeBytes {
  param(
    [Parameter(Mandatory = $true)][IO.FileStream]$Stream,
    [Parameter(Mandatory = $true)][UInt64]$Position,
    [Parameter(Mandatory = $true)][int]$Count,
    [Parameter(Mandatory = $true)][UInt64]$FileLength
  )
  if ($Count -lt 1 -or $Count -gt 4096 -or $Position -gt $FileLength -or [UInt64]$Count -gt ($FileLength - $Position)) {
    throw "PE read is outside the bounded file: offset $Position, bytes $Count, file length $FileLength."
  }
  $null = $Stream.Seek([Int64]$Position, [IO.SeekOrigin]::Begin)
  $buffer = New-Object byte[] $Count
  $received = 0
  while ($received -lt $Count) {
    $read = $Stream.Read($buffer, $received, $Count - $received)
    if ($read -le 0) { throw 'PE read ended before the requested bytes were received.' }
    $received += $read
  }
  return $buffer
}

function Get-PeSignatureStatus {
  param([Parameter(Mandatory = $true)][string]$LiteralPath)
  $file = Get-Item -LiteralPath $LiteralPath -ErrorAction Stop
  $maxPeBytes = [UInt64]1500000000
  if ($file.PSIsContainer -or $file.Length -lt 64 -or [UInt64]$file.Length -gt $maxPeBytes) {
    throw "Setup.exe is not a bounded PE file: $LiteralPath."
  }
  $stream = $null
  try {
    $stream = [IO.File]::Open($LiteralPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $fileLength = [UInt64]$file.Length
    $dos = Read-PeBytes -Stream $stream -Position 0 -Count 64 -FileLength $fileLength
    if ($dos[0] -ne 0x4d -or $dos[1] -ne 0x5a) { throw 'Setup.exe does not have a valid DOS header.' }
    $peOffset = [UInt64][BitConverter]::ToUInt32($dos, 0x3c)
    $signature = Read-PeBytes -Stream $stream -Position $peOffset -Count 4 -FileLength $fileLength
    if ($signature[0] -ne 0x50 -or $signature[1] -ne 0x45 -or $signature[2] -ne 0 -or $signature[3] -ne 0) { throw 'Setup.exe does not have a valid PE signature.' }
    $coff = Read-PeBytes -Stream $stream -Position ($peOffset + 4) -Count 20 -FileLength $fileLength
    $optionalSize = [int][BitConverter]::ToUInt16($coff, 16)
    if ($optionalSize -lt 2 -or $optionalSize -gt 4096) { throw "Setup.exe has an unsupported optional-header size: $optionalSize." }
    $optional = Read-PeBytes -Stream $stream -Position ($peOffset + 24) -Count $optionalSize -FileLength $fileLength
    $magic = [BitConverter]::ToUInt16($optional, 0)
    $directoryOffset = if ($magic -eq 0x10b) { 96 } elseif ($magic -eq 0x20b) { 112 } else { throw "Setup.exe has an unsupported PE optional-header magic: $magic." }
    $securityDirectoryEnd = $directoryOffset + (8 * 5)
    if ($optionalSize -lt $securityDirectoryEnd) { throw 'Setup.exe optional header is truncated before the security directory.' }
    # IMAGE_DIRECTORY_ENTRY_SECURITY is data-directory index 4. Its virtual
    # address is a file offset for PE images, not an RVA.
    $certificateOffset = [UInt64][BitConverter]::ToUInt32($optional, $directoryOffset + 32)
    $certificateSize = [UInt64][BitConverter]::ToUInt32($optional, $directoryOffset + 36)
    if ($certificateOffset -eq 0 -and $certificateSize -eq 0) {
      return [pscustomobject]@{ Status = 'NotSigned'; CertificateTableOffset = [UInt64]0; CertificateTableSize = [UInt64]0 }
    }
    if ($certificateOffset -gt $fileLength -or $certificateSize -gt ($fileLength - $certificateOffset)) {
      throw 'Setup.exe certificate table is truncated or outside the file.'
    }
    return [pscustomobject]@{ Status = 'CertificateTablePresent'; CertificateTableOffset = $certificateOffset; CertificateTableSize = $certificateSize }
  }
  finally {
    if ($stream) { $stream.Dispose() }
  }
}

function Invoke-ProjectInstaller {
  param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)]$Tools)
  Assert-UnsignedSquirrelConfiguration -Root $Root
  Remove-GeneratedDirectory -Root $Root -Name 'release'
  Invoke-CheckedTool -Executable $Tools.Npx -Arguments @('electron-builder', '--win', 'squirrel', '--publish', 'never') -Description 'electron-builder Squirrel.Windows packaging' -WorkingDirectory $Root
  $releaseRoot = Join-Path $Root 'release'
  $setup = Get-ChildItem -LiteralPath $releaseRoot -Recurse -File -Filter '*Setup.exe' | Select-Object -First 1
  if (-not $setup) { throw 'The installer build did not produce Setup.exe.' }
  $releases = Get-ChildItem -LiteralPath $releaseRoot -Recurse -File -Filter 'RELEASES' | Select-Object -First 1
  $nupkg = Get-ChildItem -LiteralPath $releaseRoot -Recurse -File -Filter '*-full.nupkg' | Select-Object -First 1
  if (-not $releases -or -not $nupkg) { throw 'The installer build did not produce RELEASES and a full .nupkg.' }
  $signature = Get-PeSignatureStatus -LiteralPath $setup.FullName
  if ($signature.Status -ne 'NotSigned') { throw "Code signing is prohibited, but Setup.exe reported $($signature.Status)." }
  $identity = Get-SourceIdentity -Root $Root
  $rootPrefix = ([IO.Path]::GetFullPath($Root)).TrimEnd('\') + '\'
  $manifest = [ordered]@{
    schemaVersion = 'ding-ding-app-store.local-installer.v1'
    sourceCommit = $identity.Commit
    sourceDirty = $identity.Dirty
    signed = $false
    generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
    artifacts = @($setup, $releases, $nupkg | ForEach-Object {
      $relative = $_.FullName.Substring($rootPrefix.Length).Replace('\', '/')
      [ordered]@{ name = $_.Name; path = $relative; bytes = $_.Length; sha256 = (Get-Sha256 -LiteralPath $_.FullName) }
    })
  }
  $manifestPath = Join-Path $releaseRoot 'local-installer-manifest.json'
  $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
  return [pscustomobject]@{ Setup = $setup; Releases = $releases; Nupkg = $nupkg; Manifest = $manifestPath; Identity = $identity }
}

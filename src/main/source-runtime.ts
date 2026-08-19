import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, realpath, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { SourceDisposalReceipt, SourceIsolationStatus, SourceJobDecision, SourceJobState, SourceOutputFile, SourceOutputManifest, SourceTerminalEvent, SourceTerminalStream } from '../shared/contracts.js';
import { sourceDisposalReceiptSchema, sourceOutputFileSchema, sourceOutputManifestSchema } from '../shared/contracts.js';
import { extractZipSafe } from './safe-zip.js';

export const SOURCE_RUNTIME_LIMITS = Object.freeze({
  maxEvents: 2_000,
  maxEventBytes: 2_048,
  maxOutputBytes: 2_000_000,
  maxFilesChangedPerRepair: 80,
  maxRepairDiffBytes: 512_000,
  maxRepairAttempts: 2,
  maxStepMs: 30 * 60_000,
  maxJobMs: 90 * 60_000,
  maxWorkspaceFiles: 20_000,
  maxWorkspaceBytes: 2_000_000_000,
  maxWorkspaceDepth: 64,
});

/**
 * The challenge is intentionally short-lived. It is only an admission
 * handshake; the capability lease below carries the bounded lifetime of the
 * actual job. Keeping these windows separate prevents a replayed attestation
 * from being accepted while a long source job is still allowed to run.
 */
export const SOURCE_BROKER_LIMITS = Object.freeze({
  challengeTtlMs: 30_000,
  clockSkewMs: 5_000,
  teardownGraceMs: 10_000,
});

export const SOURCE_GUEST_PROTOCOL_VERSION = 1 as const;
export const SOURCE_GUEST_IDENTITY = Object.freeze({ brokerId: 'ding-ding-windows-sandbox', transportId: 'windows-sandbox-zero-mount-v1' });
const nonceSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const SOURCE_GUEST_POLICY = Object.freeze({
  kind: 'hard-disposable' as const,
  hostMounts: 0,
  userProfileMounted: false,
  credentialsInjected: false,
  secretsInjected: false,
  shellStringsAllowed: false,
  network: 'recipe-and-opencode-only' as const,
  clipboardRedirection: false,
  protectedClient: true,
  cleanupOnExit: true,
});

/** Guest-side installer lifecycle is deliberately narrower than source steps.
 * These are facts and operations the guest agent may report; it cannot submit
 * an arbitrary command, executable, host path, or installer argument. */
export const guestInstallerOperationSchema = z.enum([
  'squirrel-install', 'squirrel-launch', 'squirrel-uninstall',
  'nsis-install', 'nsis-launch', 'nsis-uninstall',
  'inno-install', 'inno-launch', 'inno-uninstall',
]);
export type GuestInstallerOperation = z.infer<typeof guestInstallerOperationSchema>;

const installerFormatSchema = z.enum(['squirrel', 'nsis', 'inno']);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/);
const lifecycleStageSchema = z.enum(['installer-bytes', 'install', 'launch', 'uninstall', 'absence', 'disposal']);
const lifecycleProcessFactSchema = z.strictObject({
  pid: z.number().int().positive().max(4_000_000).optional(),
  ready: z.literal(true),
  windowTitle: z.string().max(240).optional(),
  windowClass: z.string().max(240).optional(),
  hwnd: z.string().regex(/^0x[0-9a-f]+$/i).optional(),
}).superRefine((fact, ctx) => {
  if (fact.windowTitle === undefined || fact.windowClass === undefined) ctx.addIssue({ code: 'custom', message: 'Readiness requires the actual inner-app window title and class.' });
  if (fact.hwnd === undefined) ctx.addIssue({ code: 'custom', message: 'Readiness requires the actual inner-app HWND.' });
});

export const guestLifecyclePlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
  protocolVersion: z.literal(SOURCE_GUEST_PROTOCOL_VERSION),
  jobId: z.uuid(),
  challengeNonce: nonceSchema,
  guestId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  planDigest: digestSchema,
  appId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  expectedPackage: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
  expectedVersion: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,63}$/),
  registryDisplayName: z.string().min(1).max(240),
  squirrelPackageName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
  executableFileName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.exe$/i),
  executableSha256: digestSchema,
  installIdentity: z.string().regex(/^[A-Za-z0-9._:-]{1,240}$/),
  executableRelativeName: z.string().min(1).max(240).refine((value) => !path.isAbsolute(value) && !value.includes('\\') && !value.split('/').some((part) => !part || part === '..'), 'Executable name must be a workspace-relative path.'),
  expectedWindowTitle: z.string().min(1).max(240),
  expectedWindowClass: z.string().min(1).max(240),
  readinessTimeoutMs: z.number().int().min(1_000).max(SOURCE_RUNTIME_LIMITS.maxStepMs),
  stabilityTimeoutMs: z.number().int().min(250).max(60_000),
  installer: z.strictObject({ format: installerFormatSchema, bytes: z.number().int().positive().max(500 * 1024 * 1024), sha256: digestSchema }),
  operations: z.array(guestInstallerOperationSchema).min(1).max(3).refine((values) => new Set(values).size === values.length, 'Lifecycle operations must be unique.'),
  maxStageMs: z.number().int().min(1_000).max(SOURCE_RUNTIME_LIMITS.maxStepMs),
}).superRefine((plan, ctx) => {
  const prefix = `${plan.installer.format}-`;
  if (plan.operations.some((operation) => !operation.startsWith(prefix))) ctx.addIssue({ code: 'custom', path: ['operations'], message: 'Lifecycle operations must match the installer format.' });
  const expected = [`${plan.installer.format}-install`, `${plan.installer.format}-launch`, `${plan.installer.format}-uninstall`];
  if (plan.operations.length !== expected.length || plan.operations.some((operation, index) => operation !== expected[index])) ctx.addIssue({ code: 'custom', path: ['operations'], message: 'Lifecycle operations must be the ordered install, launch, uninstall sequence.' });
});
export type GuestLifecyclePlan = z.infer<typeof guestLifecyclePlanSchema>;
export function createGuestLifecyclePlanDigest(plan: Omit<GuestLifecyclePlan, 'planDigest'> | GuestLifecyclePlan): string {
  const { planDigest: _ignored, ...unsigned } = plan as GuestLifecyclePlan;
  return createHash('sha256').update(stableJson(unsigned)).digest('hex');
}

export const guestLifecycleReceiptSchema = z.strictObject({
  schemaVersion: z.literal(1),
  protocolVersion: z.literal(SOURCE_GUEST_PROTOCOL_VERSION),
  jobId: z.uuid(),
  challengeNonce: nonceSchema,
  guestId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  planDigest: digestSchema,
  sequence: z.number().int().min(1).max(64),
  stage: lifecycleStageSchema,
  operation: guestInstallerOperationSchema.optional(),
  installerBytes: z.number().int().nonnegative().max(500 * 1024 * 1024).optional(),
  installerSha256: digestSchema.optional(),
  installedIdentity: z.string().regex(/^[A-Za-z0-9._:-]{1,240}$/).optional(),
  installedVersion: z.string().regex(/^[A-Za-z0-9.+_-]{1,64}$/).optional(),
  executableSha256: digestSchema.optional(),
  process: lifecycleProcessFactSchema.optional(),
  uninstallSucceeded: z.boolean().optional(),
  absenceVerified: z.literal(true).optional(),
  childProcessesStopped: z.literal(true).optional(),
  observedAt: z.iso.datetime(),
  details: z.string().max(1_024).optional(),
});
export type GuestLifecycleReceipt = z.infer<typeof guestLifecycleReceiptSchema>;

export const guestLifecycleFinalReceiptSchema = z.strictObject({
  schemaVersion: z.literal(1), protocolVersion: z.literal(SOURCE_GUEST_PROTOCOL_VERSION),
  jobId: z.uuid(), challengeNonce: nonceSchema, guestId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/), planDigest: digestSchema,
  lastSequence: z.number().int().min(1).max(64), verdict: z.literal(true),
  installIdentity: z.string().regex(/^[A-Za-z0-9._:-]{1,240}$/), processReady: z.literal(true),
  windowTitle: z.string().min(1).max(240), windowClass: z.string().min(1).max(240), hwnd: z.string().regex(/^0x[0-9a-f]+$/i),
  uninstallSucceeded: z.literal(true), absenceVerified: z.literal(true), childProcessesStopped: z.literal(true),
  observedAt: z.iso.datetime(),
});
export type GuestLifecycleFinalReceipt = z.infer<typeof guestLifecycleFinalReceiptSchema>;

/** Fixed guest-side bootstrap. It is embedded in the .wsb command so no host
 * folder is mapped into the guest. The only host communication is the
 * nonce-bound loopback/gateway protocol supplied by the transport. */
export const WINDOWS_SANDBOX_GUEST_BOOTSTRAP = String.raw`$ErrorActionPreference = 'Stop'
$protocol = 1
$jobId = $runnerArgs[0]
$nonce = $runnerArgs[1]
$endpoint = $runnerArgs[2]
$token = $runnerArgs[3]
$headers = @{ 'X-Ding-Ding-Runner' = $token; 'X-Ding-Ding-Protocol' = "$protocol" }
$receiptHeaders = $null
function Send-Runner($route, $body) {
  Invoke-RestMethod -Method Post -Uri "$endpoint$route" -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 12 -Compress)
}
function Send-Receipt($route, $body) {
  if (-not $receiptHeaders) { throw 'The one-time lifecycle receipt token was not issued.' }
  Invoke-RestMethod -Method Post -Uri "$endpoint$route" -Headers $receiptHeaders -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 12 -Compress)
}
$hello = @{ protocolVersion = $protocol; jobId = $jobId; challengeNonce = $nonce; guestId = "guest-$jobId"; hostMounts = 0; credentialsInjected = $false; secretsInjected = $false; shellStringsAllowed = $false; userProfileMounted = $false }
$helloResponse = Send-Runner "/hello/$jobId" $hello
if (-not $helloResponse.receiptToken -or $helloResponse.receiptToken -notmatch '^[a-f0-9]{64}$') { throw 'The protocol peer did not issue a one-time lifecycle receipt token.' }
$receiptHeaders = @{ 'X-Ding-Ding-Receipt' = $helloResponse.receiptToken; 'X-Ding-Ding-Protocol' = "$protocol" }
$helloResponse = $null
$plan = $null
$lifecyclePlan = $null
$planDeadline = [DateTimeOffset]::UtcNow.AddSeconds(30)
while (-not $plan -and -not $lifecyclePlan -and [DateTimeOffset]::UtcNow -lt $planDeadline) {
  try { $plan = Invoke-RestMethod -Method Get -Uri "$endpoint/plan/$jobId" -Headers $headers -ErrorAction Stop } catch { }
  try { $lifecyclePlan = Invoke-RestMethod -Method Get -Uri "$endpoint/lifecycle-plan/$jobId" -Headers $headers -ErrorAction Stop } catch { }
  if ($plan -and $lifecyclePlan) { throw 'Runner published both source and lifecycle plans.' }
  if (-not $plan -and -not $lifecyclePlan) { Start-Sleep -Milliseconds 150 }
}
if (-not $plan -and -not $lifecyclePlan) { throw 'Runner plan was not published before the bounded handshake deadline.' }
if ($lifecyclePlan) { $plan = $lifecyclePlan }
if ($plan.protocolVersion -ne $protocol -or $plan.jobId -ne $jobId -or $plan.challengeNonce -ne $nonce -or $plan.policy.hostMounts -ne 0 -or $plan.policy.credentialsInjected -ne $false -or $plan.policy.secretsInjected -ne $false -or $plan.policy.shellStringsAllowed -ne $false) { throw 'Runner plan or policy binding was rejected.' }
if ($lifecyclePlan) {
  function Wait-Until([scriptblock]$Predicate, [int]$TimeoutMs) {
    $deadline = [DateTimeOffset]::UtcNow.AddMilliseconds($TimeoutMs)
    do { if (& $Predicate) { return $true }; Start-Sleep -Milliseconds 100 } while ([DateTimeOffset]::UtcNow -lt $deadline)
    return (& $Predicate)
  }
  $installer = Join-Path $env:TEMP "ding-ding-$jobId-installer.exe"
  Invoke-WebRequest -Method Get -Uri "$endpoint/installer/$jobId" -Headers $headers -OutFile $installer -UseBasicParsing
  $installerHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $installer).Hash.ToLowerInvariant()
  if ((Get-Item -LiteralPath $installer).Length -ne $lifecyclePlan.installer.bytes -or $installerHash -ne $lifecyclePlan.installer.sha256) { throw 'Installer bytes did not match the reviewed lifecycle plan.' }
  $family = $lifecyclePlan.installer.format
  $installIdentity = $lifecyclePlan.installIdentity
  $installRoot = Join-Path $env:TEMP "ding-ding-$jobId-install"
  New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
  # Only fixed, family-derived operations are permitted. Plan data never supplies a command or argument.
  switch ($family) {
    'squirrel' { $installerArgs = @('--silent'); $uninstallArgs = @('--uninstall') }
    'nsis' { $installerArgs = @('/S'); $uninstallArgs = @('/S', '/_?=') }
    'inno' { $installerArgs = @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART'); $uninstallArgs = @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') }
    default { throw 'Installer family is not allowlisted.' }
  }
  # The fixed guest helper is intentionally conservative: it does not treat the Sandbox wrapper HWND as readiness.
  $children = @()
  $installProcess = Start-Process -FilePath $installer -ArgumentList ([string[]]$installerArgs) -WorkingDirectory $installRoot -PassThru -Wait
  if ($installProcess.ExitCode -ne 0) { throw 'Reviewed installer exited unsuccessfully.' }
  Send-Receipt "/stage-receipt/$jobId" @{ schemaVersion = 1; protocolVersion = $protocol; jobId = $jobId; challengeNonce = $nonce; guestId = "guest-$jobId"; planDigest = $lifecyclePlan.planDigest; sequence = 1; stage = 'installer-bytes'; installerBytes = [int64](Get-Item -LiteralPath $installer).Length; installerSha256 = $installerHash; observedAt = [DateTimeOffset]::UtcNow.ToString('o') } | Out-Null
  Send-Receipt "/stage-receipt/$jobId" @{ schemaVersion = 1; protocolVersion = $protocol; jobId = $jobId; challengeNonce = $nonce; guestId = "guest-$jobId"; planDigest = $lifecyclePlan.planDigest; sequence = 2; stage = 'install'; operation = "$family-install"; observedAt = [DateTimeOffset]::UtcNow.ToString('o') } | Out-Null
  if ($family -ne 'squirrel') { throw 'Only the reviewed Squirrel lifecycle helper is enabled; NSIS and Inno remain blocked.' }
  $uninstallRoots = @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*')
  $records = @(Get-ItemProperty -Path $uninstallRoots -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq $lifecyclePlan.registryDisplayName -and $_.DisplayVersion -eq $lifecyclePlan.expectedVersion -and $_.InstallLocation })
  if ($records.Count -ne 1) { throw 'The exact Squirrel uninstall identity was absent or ambiguous.' }
  $record = $records[0]
  function Canonical([string]$value) { return [IO.Path]::GetFullPath($value).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar) }
  function Assert-NoReparse([string]$root, [string]$candidate) {
    $rootCanonical = Canonical $root
    $candidateCanonical = Canonical $candidate
    $prefix = "$rootCanonical\"
    if (-not $candidateCanonical.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'The Squirrel path was outside guest LOCALAPPDATA; sibling prefixes are not containment.' }
    $relative = $candidateCanonical.Substring($prefix.Length)
    $cursor = $rootCanonical
    if (Test-Path -LiteralPath $cursor) {
      $rootItem = Get-Item -LiteralPath $cursor -Force
      if (($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Guest LOCALAPPDATA itself was a reparse point.' }
    }
    foreach ($part in $relative -split '\\') {
      if (-not $part) { continue }
      $cursor = Join-Path $cursor $part
      if (Test-Path -LiteralPath $cursor) {
        $item = Get-Item -LiteralPath $cursor -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'A reparse component was present in the reviewed Squirrel path.' }
      }
    }
    return $candidateCanonical
  }
  $localRoot = Canonical $env:LOCALAPPDATA
  $installRoot = Assert-NoReparse $localRoot $record.InstallLocation
  $versionDirs = @(Get-ChildItem -LiteralPath $installRoot -Directory -Force | Where-Object { $_.Name -match '^app-' -and -not ($_.Attributes.ToString() -match 'ReparsePoint') })
  $exeMatches = @($versionDirs | ForEach-Object { Assert-NoReparse $installRoot (Join-Path $_.FullName $lifecyclePlan.executableFileName) } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf -and (Split-Path $_ -Leaf) -ne 'Update.exe' })
  if ($exeMatches.Count -ne 1) { throw 'The exact Squirrel executable was absent or ambiguous.' }
  $exeHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $exeMatches[0]).Hash.ToLowerInvariant()
  if ($exeHash -ne $lifecyclePlan.executableSha256) { throw 'The exact Squirrel executable digest did not match the reviewed plan.' }
  Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class GuestWindowProbe { [DllImport("user32.dll", SetLastError=true)] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid); [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder name, int max); }
'@
  $app = Start-Process -FilePath $exeMatches[0] -WorkingDirectory (Split-Path $exeMatches[0]) -PassThru
  $deadline = [DateTimeOffset]::UtcNow.AddMilliseconds($lifecyclePlan.readinessTimeoutMs); $hwnd = [IntPtr]::Zero
  while ([DateTimeOffset]::UtcNow -lt $deadline -and $hwnd -eq [IntPtr]::Zero) { $app.Refresh(); $hwnd = $app.MainWindowHandle; if ($hwnd -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 100 } }
  if ($hwnd -eq [IntPtr]::Zero -or $app.MainWindowTitle -ne $lifecyclePlan.expectedWindowTitle) { throw 'Squirrel child did not expose the reviewed inner-app window.' }
  $windowPid = 0; [void][GuestWindowProbe]::GetWindowThreadProcessId($hwnd, [ref]$windowPid); $class = New-Object Text.StringBuilder 256; [void][GuestWindowProbe]::GetClassName($hwnd, $class, $class.Capacity)
  if ($windowPid -ne $app.Id -or $class.ToString() -ne $lifecyclePlan.expectedWindowClass -or $class.ToString() -match 'Sandbox|ApplicationFrameHost') { throw 'Wrapper or foreign window readiness was rejected.' }
  Start-Sleep -Milliseconds $lifecyclePlan.stabilityTimeoutMs
  Send-Receipt "/stage-receipt/$jobId" @{ schemaVersion=1; protocolVersion=$protocol; jobId=$jobId; challengeNonce=$nonce; guestId="guest-$jobId"; planDigest=$lifecyclePlan.planDigest; sequence=3; stage='launch'; operation='squirrel-launch'; installedIdentity=$record.DisplayName; installedVersion=$record.DisplayVersion; executableSha256=$exeHash; process=@{ ready=$true; pid=$app.Id; windowTitle=$app.MainWindowTitle; windowClass=$class.ToString(); hwnd=('0x{0:x}' -f $hwnd.ToInt64()) }; observedAt=[DateTimeOffset]::UtcNow.ToString('o') } | Out-Null
  if ($app.HasExited) { throw 'Squirrel child exited before uninstall.' }
  $descendantPids = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($app.Id)" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessId)
  $kill = Start-Process -FilePath 'taskkill.exe' -ArgumentList @('/PID', [string]$app.Id, '/T', '/F') -Wait -PassThru -WindowStyle Hidden
  if ($kill.ExitCode -ne 0 -and -not $app.HasExited) { throw 'The reviewed child process tree did not accept taskkill.' }
  if (-not (Wait-Until { $app.HasExited -and @($descendantPids | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }).Count -eq 0 } $lifecyclePlan.maxStageMs)) { throw 'The reviewed child process tree did not become absent within the bounded stage limit.' }
  $update = Assert-NoReparse $installRoot (Join-Path $installRoot 'Update.exe'); if (-not (Test-Path -LiteralPath $update -PathType Leaf)) { throw 'Squirrel Update.exe was absent.' }
  $uninstall = Start-Process -FilePath $update -ArgumentList @('--uninstall','-s') -WorkingDirectory $installRoot -PassThru -Wait
  if ($uninstall.ExitCode -ne 0) { throw 'Squirrel uninstall exited unsuccessfully.' }
  Send-Receipt "/stage-receipt/$jobId" @{ schemaVersion=1; protocolVersion=$protocol; jobId=$jobId; challengeNonce=$nonce; guestId="guest-$jobId"; planDigest=$lifecyclePlan.planDigest; sequence=4; stage='uninstall'; operation='squirrel-uninstall'; uninstallSucceeded=$true; observedAt=[DateTimeOffset]::UtcNow.ToString('o') } | Out-Null
  if (-not (Wait-Until { $remaining = @(Get-ItemProperty -Path $uninstallRoots -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq $lifecyclePlan.registryDisplayName -and $_.DisplayVersion -eq $lifecyclePlan.expectedVersion }); $remaining.Count -eq 0 -and -not (Test-Path -LiteralPath $installRoot) -and -not (Test-Path -LiteralPath $exeMatches[0]) -and $app.HasExited } $lifecyclePlan.maxStageMs)) { throw 'Squirrel uninstall absence was not proven within the bounded stage limit.' }
  Send-Receipt "/stage-receipt/$jobId" @{ schemaVersion=1; protocolVersion=$protocol; jobId=$jobId; challengeNonce=$nonce; guestId="guest-$jobId"; planDigest=$lifecyclePlan.planDigest; sequence=5; stage='absence'; absenceVerified=$true; observedAt=[DateTimeOffset]::UtcNow.ToString('o') } | Out-Null
  Send-Receipt "/stage-receipt/$jobId" @{ schemaVersion=1; protocolVersion=$protocol; jobId=$jobId; challengeNonce=$nonce; guestId="guest-$jobId"; planDigest=$lifecyclePlan.planDigest; sequence=6; stage='disposal'; childProcessesStopped=$true; observedAt=[DateTimeOffset]::UtcNow.ToString('o') } | Out-Null
  Send-Receipt "/final-receipt/$jobId" @{ schemaVersion=1; protocolVersion=$protocol; jobId=$jobId; challengeNonce=$nonce; guestId="guest-$jobId"; planDigest=$lifecyclePlan.planDigest; lastSequence=6; verdict=$true; installIdentity=$installIdentity; processReady=$true; windowTitle=$lifecyclePlan.expectedWindowTitle; windowClass=$lifecyclePlan.expectedWindowClass; hwnd=('0x{0:x}' -f $hwnd.ToInt64()); uninstallSucceeded=$true; absenceVerified=$true; childProcessesStopped=$true; observedAt=[DateTimeOffset]::UtcNow.ToString('o') } | Out-Null
  Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
  exit 0
}
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
    Send-Runner "/event/$jobId" @{ stream = 'progress'; state = 'running'; text = "Starting $($step.id)"; progress = 10 } | Out-Null
    $executable = if ($step.executable -match '[/\\]') { Join-Path $workspace $step.executable } else { $step.executable }
    $arguments = @($step.arguments | ForEach-Object { if ($_ -match '^toolchain/') { Join-Path $workspace $_ } else { $_ } })
    $p = Start-Process -FilePath $executable -ArgumentList ([string[]]$arguments) -WorkingDirectory (Join-Path $workspace $step.cwd) -NoNewWindow -PassThru -Wait
    if ($p.ExitCode -ne 0) { throw "Reviewed step $($step.id) exited with code $($p.ExitCode)." }
  }
  $files = Get-ChildItem -LiteralPath $workspace -File -Recurse | Where-Object { $_.FullName -notlike "$workspace\source.zip" }
  $manifest = @($files | ForEach-Object { $relative = $_.FullName.Substring($workspace.Length + 1).Replace([char]92,'/'); @{ path = $relative; bytes = $_.Length; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant() } })
  foreach ($file in $files) {
    $relative = $file.FullName.Substring($workspace.Length + 1).Replace([char]92,'/')
    $bytes = [IO.File]::ReadAllBytes($file.FullName)
    Send-Runner "/output/$jobId" @{ path = $relative; bytes = $bytes.Length; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToLowerInvariant(); contentBase64 = [Convert]::ToBase64String($bytes) } | Out-Null
  }
  Send-Runner "/outputs/$jobId" @{ schemaVersion = 1; jobId = $jobId; appId = $plan.appId; revision = $plan.revision; decision = $plan.decision; generatedAt = [DateTimeOffset]::UtcNow.ToString('o'); totalBytes = ($manifest | Measure-Object -Property bytes -Sum).Sum; files = $manifest } | Out-Null
  Send-Runner "/complete/$jobId" @{ jobId = $jobId; ok = $true } | Out-Null
} finally {
  Remove-Item -LiteralPath $workspace -Recurse -Force -ErrorAction SilentlyContinue
}`;

export function createZeroMountSandboxConfig(command: string): string {
  if (!command || /[\r\n]/.test(command)) throw new Error('Sandbox logon command must be one bounded command.');
  const escaped = command.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  return `<Configuration><VGpu>Disable</VGpu><Networking>Enable</Networking><ClipboardRedirection>Disable</ClipboardRedirection><AudioInput>Disable</AudioInput><VideoInput>Disable</VideoInput><ProtectedClient>Enable</ProtectedClient><MappedFolders></MappedFolders><LogonCommand><Command>${escaped}</Command></LogonCommand></Configuration>`;
}

export const PINNED_OPENCODE = Object.freeze({
  version: '1.18.15',
  assetName: 'opencode-windows-x64.zip',
  url: 'https://github.com/anomalyco/opencode/releases/download/v1.18.15/opencode-windows-x64.zip',
  sha256: 'a80785874978ccbb93b7bfe4345f5aed41696f5ae76c109cd6dbbb934dbe795d',
  executableSha256: 'fd254474def7ee35f07416cf4674c361f07e7bcd9c7ffb284af21bb011066ee3',
  executable: 'opencode.exe',
});

const relativePathSchema = z.string().min(1).max(240).refine((value) => {
  if (path.isAbsolute(value) || value.includes('\0')) return false;
  const normalized = value.replaceAll('\\', '/');
  return !normalized.split('/').some((segment) => segment === '..' || segment === '');
}, 'Path must be a bounded workspace-relative path.');

const argumentSchema = z.string().max(500).refine(
  (value) => !/[\0\r\n;&|<>`]/.test(value) && !/^[A-Za-z]:[\\/]/.test(value) && !value.startsWith('\\\\'),
  'Arguments cannot contain shell operators, control characters, or absolute host paths.',
);

const sourceExecutableSchema = z.string().trim().min(1).max(240).refine((value) => {
  if (value.toLowerCase() === 'git.exe' || value.toLowerCase() === 'git') return false;
  if (path.isAbsolute(value) || value.includes('\\') && /^[A-Za-z]:/.test(value)) return false;
  const normalized = value.replaceAll('\\', '/');
  if (normalized.split('/').some((segment) => segment === '..' || segment === '' || segment.includes(':'))) return false;
  return ['node.exe', 'py.exe', 'python.exe', 'cargo.exe', 'cmake.exe', 'ninja.exe', 'dotnet.exe', 'powershell.exe', 'msbuild.exe'].includes(normalized.toLowerCase())
    || normalized.toLowerCase() === 'toolchain/node/node.exe';
}, 'Executables must be fixed workspace-relative paths or reviewed tool names; Git and absolute paths are not permitted.');

export const sourceStepSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  label: z.string().trim().min(1).max(120),
  executable: sourceExecutableSchema,
  arguments: z.array(argumentSchema).max(48),
  cwd: relativePathSchema,
  timeoutMs: z.number().int().min(1_000).max(SOURCE_RUNTIME_LIMITS.maxStepMs),
  expectedOutputs: z.array(relativePathSchema).max(24),
});

export const dependencyBootstrapSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  version: z.string().regex(/^[A-Za-z0-9.+_-]{1,40}$/),
  canonicalUrl: z.string().url().refine((value) => new URL(value).protocol === 'https:', 'Dependency sources must use HTTPS.'),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  archive: z.enum(['zip', 'tar.gz', 'none']),
  destination: relativePathSchema,
  executable: relativePathSchema,
});

export const sourceReadinessSchema = z.strictObject({
  kind: z.enum(['output-files', 'process', 'window']),
  target: z.string().trim().min(1).max(240),
  timeoutMs: z.number().int().min(1_000).max(SOURCE_RUNTIME_LIMITS.maxStepMs),
});

export const sourceRecipeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  status: z.enum(['ready', 'blocked']).default('ready'),
  blocker: z.string().trim().min(1).max(500).optional(),
  appId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  repository: z.string().regex(/^Ding-Ding-Projects\/[A-Za-z0-9_.-]+$/),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  sourceArchiveSha256: z.string().regex(/^[a-f0-9]{64}$/),
  dependencies: z.array(dependencyBootstrapSchema).max(32),
  prepare: z.array(sourceStepSchema).max(16),
  validate: z.array(sourceStepSchema).max(16),
  build: z.array(sourceStepSchema).max(24),
  test: z.array(sourceStepSchema).max(24),
  run: z.array(sourceStepSchema).max(8),
  readiness: sourceReadinessSchema,
  repairableStepIds: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,47}$/)).max(32),
  finalOutputs: z.array(relativePathSchema).max(32),
  repairAttempts: z.number().int().min(0).max(SOURCE_RUNTIME_LIMITS.maxRepairAttempts),
});

export const sourceRecipeCatalogSchema = z.strictObject({
  schemaVersion: z.literal(1),
  recipes: z.array(sourceRecipeSchema).max(24),
}).superRefine((catalog, ctx) => {
  const ids = catalog.recipes.map((recipe) => recipe.appId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['recipes'], message: 'Recipe app IDs must be unique.' });
  catalog.recipes.forEach((recipe, index) => {
    const steps = [...recipe.prepare, ...recipe.validate, ...recipe.build, ...recipe.test, ...recipe.run];
    const stepIds = steps.map((step) => step.id);
    if (new Set(stepIds).size !== stepIds.length) ctx.addIssue({ code: 'custom', path: ['recipes', index], message: 'Step IDs must be unique.' });
    for (const repairId of recipe.repairableStepIds) {
      if (!stepIds.includes(repairId)) ctx.addIssue({ code: 'custom', path: ['recipes', index, 'repairableStepIds'], message: `Unknown repairable step: ${repairId}` });
    }
    if (recipe.status === 'ready' && recipe.validate.length === 0) ctx.addIssue({ code: 'custom', path: ['recipes', index, 'validate'], message: 'Ready recipes require at least one validation step.' });
    if (recipe.status === 'ready' && recipe.build.length === 0) ctx.addIssue({ code: 'custom', path: ['recipes', index, 'build'], message: 'Ready recipes require at least one build step.' });
    if (recipe.status === 'ready' && recipe.blocker) ctx.addIssue({ code: 'custom', path: ['recipes', index, 'blocker'], message: 'Ready recipes cannot carry a blocker.' });
    if (recipe.status === 'blocked' && !recipe.blocker) ctx.addIssue({ code: 'custom', path: ['recipes', index, 'blocker'], message: 'Blocked recipes require a precise blocker.' });
    if (recipe.status === 'blocked' && steps.length > 0) ctx.addIssue({ code: 'custom', path: ['recipes', index], message: 'Blocked recipes cannot expose executable steps.' });
    if (recipe.status === 'ready' && recipe.finalOutputs.length === 0) ctx.addIssue({ code: 'custom', path: ['recipes', index, 'finalOutputs'], message: 'Ready recipes require at least one reviewed final output.' });
    if (recipe.status === 'blocked' && recipe.finalOutputs.length > 0) ctx.addIssue({ code: 'custom', path: ['recipes', index, 'finalOutputs'], message: 'Blocked recipes cannot claim a final output.' });
    if (recipe.status === 'ready' && recipe.readiness.target === 'not-applicable') ctx.addIssue({ code: 'custom', path: ['recipes', index, 'readiness', 'target'], message: 'Ready recipes require a concrete readiness target.' });
    if (recipe.status === 'blocked' && recipe.readiness.target !== 'not-applicable') ctx.addIssue({ code: 'custom', path: ['recipes', index, 'readiness', 'target'], message: 'Blocked recipes must use the not-applicable readiness target.' });
  });
});

export type SourceStep = z.infer<typeof sourceStepSchema>;
export type SourceReadiness = z.infer<typeof sourceReadinessSchema>;
export type SourceRecipe = z.infer<typeof sourceRecipeSchema>;
export type SourceRecipeCatalog = z.infer<typeof sourceRecipeCatalogSchema>;

export const isolationBrokerIdentitySchema = z.strictObject({
  brokerId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  transportId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
});

export type IsolationBrokerIdentity = z.infer<typeof isolationBrokerIdentitySchema>;

export const isolationCapabilitySchema = z.enum(['execute', 'dispose']);
export type IsolationCapability = z.infer<typeof isolationCapabilitySchema>;

export const isolationCapabilityLeaseSchema = z.strictObject({
  leaseId: z.uuid(),
  jobId: z.uuid(),
  challengeNonce: nonceSchema,
  brokerId: isolationBrokerIdentitySchema.shape.brokerId,
  transportId: isolationBrokerIdentitySchema.shape.transportId,
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  capabilities: z.array(isolationCapabilitySchema).min(1).max(2).refine((values) => new Set(values).size === values.length, 'Lease capabilities must be unique.'),
});

export type IsolationCapabilityLease = z.infer<typeof isolationCapabilityLeaseSchema>;

export const isolationAttestationChallengeSchema = z.strictObject({
  version: z.literal(1),
  jobId: z.uuid(),
  nonce: nonceSchema,
  issuedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  leaseExpiresAt: z.iso.datetime(),
  requestedCapabilities: z.array(isolationCapabilitySchema).length(2).refine((values) => new Set(values).size === values.length, 'Requested capabilities must be unique.'),
  expectedBrokerId: isolationBrokerIdentitySchema.shape.brokerId,
  expectedTransportId: isolationBrokerIdentitySchema.shape.transportId,
});

export type IsolationAttestationChallenge = z.infer<typeof isolationAttestationChallengeSchema>;

export interface IsolationRequirements {
  kind: 'hard-disposable';
  network: 'recipe-and-opencode-only';
  hostMounts: 0;
  userProfileMounted: false;
  credentialsInjected: false;
  secretsInjected: false;
  shellStringsAllowed: false;
  cleanupOnExit: true;
}

export const isolationAttestationSchema = z.strictObject({
  ...{
    kind: z.literal('hard-disposable'),
    network: z.literal('recipe-and-opencode-only'),
    hostMounts: z.literal(0),
    userProfileMounted: z.literal(false),
    credentialsInjected: z.literal(false),
    secretsInjected: z.literal(false),
    shellStringsAllowed: z.literal(false),
    cleanupOnExit: z.literal(true),
  },
  version: z.literal(1),
  jobId: z.uuid(),
  challengeNonce: nonceSchema,
  brokerId: isolationBrokerIdentitySchema.shape.brokerId,
  transportId: isolationBrokerIdentitySchema.shape.transportId,
  attestedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  lease: isolationCapabilityLeaseSchema,
});

export type IsolationAttestation = z.infer<typeof isolationAttestationSchema>;

export const REQUIRED_ISOLATION: Readonly<IsolationRequirements> = Object.freeze({
  kind: 'hard-disposable',
  network: 'recipe-and-opencode-only',
  hostMounts: 0,
  userProfileMounted: false,
  credentialsInjected: false,
  secretsInjected: false,
  shellStringsAllowed: false,
  cleanupOnExit: true,
});

export function createIsolationAttestationChallenge(
  jobId: string,
  leaseDurationMs: number,
  identity: IsolationBrokerIdentity | null,
  now = Date.now(),
): IsolationAttestationChallenge {
  const parsedJob = z.uuid().safeParse(jobId);
  if (!parsedJob.success) throw new Error('Source broker challenge requires a valid job ID.');
  const parsedIdentity = isolationBrokerIdentitySchema.safeParse(identity);
  if (!parsedIdentity.success) throw new Error('Source broker challenge requires an expected broker and transport identity.');
  if (!Number.isInteger(leaseDurationMs) || leaseDurationMs < 1 || leaseDurationMs > SOURCE_RUNTIME_LIMITS.maxJobMs) throw new Error('Source broker lease duration exceeded the bounded job limit.');
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(Math.min(now + SOURCE_BROKER_LIMITS.challengeTtlMs, now + leaseDurationMs)).toISOString();
  const leaseExpiresAt = new Date(now + leaseDurationMs + SOURCE_BROKER_LIMITS.teardownGraceMs).toISOString();
  return isolationAttestationChallengeSchema.parse({
    version: 1,
    jobId,
    nonce: randomBytes(32).toString('hex'),
    issuedAt,
    expiresAt,
    leaseExpiresAt,
    requestedCapabilities: ['execute', 'dispose'],
    expectedBrokerId: parsedIdentity.data.brokerId,
    expectedTransportId: parsedIdentity.data.transportId,
  });
}

export type AttestationValidation =
  | { ok: true; attestation: IsolationAttestation }
  | { ok: false; reason: string };

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function validateIsolationAttestation(
  input: unknown,
  challenge: IsolationAttestationChallenge,
  now = Date.now(),
): AttestationValidation {
  const parsed = isolationAttestationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'guest-attestation-schema-invalid' };
  const attestation = parsed.data;
  const challengeIssued = timestamp(challenge.issuedAt);
  const challengeExpires = timestamp(challenge.expiresAt);
  const leaseDeadline = timestamp(challenge.leaseExpiresAt);
  const attestedAt = timestamp(attestation.attestedAt);
  const attestationExpires = timestamp(attestation.expiresAt);
  const leaseIssued = timestamp(attestation.lease.issuedAt);
  const leaseExpires = timestamp(attestation.lease.expiresAt);
  if (![challengeIssued, challengeExpires, leaseDeadline, attestedAt, attestationExpires, leaseIssued, leaseExpires].every(Number.isFinite)) return { ok: false, reason: 'guest-attestation-time-invalid' };
  if (attestation.jobId !== challenge.jobId || attestation.lease.jobId !== challenge.jobId) return { ok: false, reason: 'guest-attestation-job-mismatch' };
  if (attestation.challengeNonce !== challenge.nonce || attestation.lease.challengeNonce !== challenge.nonce) return { ok: false, reason: 'guest-attestation-nonce-mismatch' };
  if (attestation.brokerId !== challenge.expectedBrokerId || attestation.transportId !== challenge.expectedTransportId) return { ok: false, reason: 'guest-attestation-identity-mismatch' };
  if (attestation.lease.brokerId !== attestation.brokerId || attestation.lease.transportId !== attestation.transportId) return { ok: false, reason: 'guest-lease-identity-mismatch' };
  if (attestedAt < challengeIssued - SOURCE_BROKER_LIMITS.clockSkewMs || attestedAt > now + SOURCE_BROKER_LIMITS.clockSkewMs) return { ok: false, reason: 'guest-attestation-not-fresh' };
  if (now > challengeExpires + SOURCE_BROKER_LIMITS.clockSkewMs || attestationExpires <= now || attestationExpires > challengeExpires + SOURCE_BROKER_LIMITS.clockSkewMs) return { ok: false, reason: 'guest-attestation-expired' };
  if (leaseIssued < attestedAt - SOURCE_BROKER_LIMITS.clockSkewMs || leaseIssued > now + SOURCE_BROKER_LIMITS.clockSkewMs || leaseExpires <= now || leaseExpires > leaseDeadline) return { ok: false, reason: 'guest-capability-lease-invalid' };
  if (!attestation.lease.capabilities.includes('execute') || !attestation.lease.capabilities.includes('dispose')) return { ok: false, reason: 'guest-capability-lease-incomplete' };
  if (!isolationMatches(attestation)) return { ok: false, reason: 'guest-isolation-requirements-mismatch' };
  return { ok: true, attestation };
}

export function validateCapabilityLease(
  lease: unknown,
  expected: Pick<IsolationAttestationChallenge, 'jobId' | 'nonce' | 'expectedBrokerId' | 'expectedTransportId'>,
  capability: IsolationCapability,
  now = Date.now(),
  allowExpired = false,
): boolean {
  const parsed = isolationCapabilityLeaseSchema.safeParse(lease);
  if (!parsed.success) return false;
  const value = parsed.data;
  if (value.jobId !== expected.jobId || value.challengeNonce !== expected.nonce || value.brokerId !== expected.expectedBrokerId || value.transportId !== expected.expectedTransportId) return false;
  if (!value.capabilities.includes(capability)) return false;
  const issuedAt = timestamp(value.issuedAt);
  const expiresAt = timestamp(value.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) return false;
  if (issuedAt > now + SOURCE_BROKER_LIMITS.clockSkewMs) return false;
  if (!allowExpired && expiresAt <= now) return false;
  return true;
}

export interface SourceExecutionPlan {
  jobId: string;
  appId: string;
  decision: SourceJobDecision;
  workspaceName: string;
  sourceArchiveUrl: string;
  sourceArchiveSha256: string;
  revision: string;
  dependencies: SourceRecipe['dependencies'];
  steps: SourceStep[];
  readiness: SourceReadiness;
  repairableStepIds: string[];
  finalOutputs: string[];
  repairAttempts: number;
  openCode: typeof PINNED_OPENCODE;
  openCodeConfig: ReturnType<typeof createOpenCodeConfig>;
  openCodeArguments: readonly ['run', '--auto'];
  forbiddenRepairEntries: readonly string[];
  protocolVersion: typeof SOURCE_GUEST_PROTOCOL_VERSION;
  policy: typeof SOURCE_GUEST_POLICY;
  planDigest: string;
}

export interface SourceGuestBootstrap {
  protocolVersion: typeof SOURCE_GUEST_PROTOCOL_VERSION;
  jobId: string;
  challengeNonce: string;
  guestId: string;
  brokerId: string;
  transportId: string;
  planDigest: string;
  policy: typeof SOURCE_GUEST_POLICY;
}

export interface SourceGuestOutput extends SourceOutputFile {
  /** Internal transfer bytes. They never cross the preload boundary. */
  content?: Buffer;
}

export interface SourceExecutionResult {
  outputs?: SourceGuestOutput[];
  outputManifest?: SourceOutputManifest;
  guestId?: string;
}

export interface IsolationBroker {
  attest(challenge: Readonly<IsolationAttestationChallenge>, signal: AbortSignal): Promise<unknown>;
  /** Implementations must reject before spawning work when the execute lease
   * is expired or the signal is already aborted, and must stop the guest when
   * the signal aborts. The main process validates the same boundary before
   * dispatch; this broker-side rule closes the transport seam. */
  execute(plan: Readonly<SourceExecutionPlan>, emit: (event: RuntimeLine) => void, signal: AbortSignal, lease: Readonly<IsolationCapabilityLease>): Promise<SourceExecutionResult | void>;
  /** A validated lease is mandatory for an admitted guest teardown. The
   * broker must consume the lease at most once; repeated calls for the same
   * job are idempotent cleanup acknowledgements, never new authority. */
  dispose(jobId: string, lease: Readonly<IsolationCapabilityLease>): Promise<SourceDisposalReceipt | void>;
  /** Pre-attestation abort path for a guest that never received a lease. */
  abort(jobId: string): Promise<void>;
  identity?(): IsolationBrokerIdentity | null;
  diagnose?(): Promise<SourceIsolationStatus>;
  recoverOrphans?(): Promise<string[]>;
}

export interface RuntimeLine {
  stream: SourceTerminalStream;
  state: SourceJobState;
  text: string;
  progress?: number | null;
}

export const runtimeLineSchema = z.strictObject({
  stream: z.enum(['system', 'progress', 'stdout', 'stderr']),
  state: z.enum(['queued', 'preparing', 'running', 'repairing', 'cancelling', 'succeeded', 'failed', 'cancelled']),
  text: z.string().max(16_384),
  progress: z.number().min(0).max(100).nullable().optional(),
});

export interface WindowsSandboxProbeOptions {
  platform?: NodeJS.Platform;
  systemRoot?: string;
  fileExists?: (filePath: string) => Promise<boolean>;
  checkedAt?: () => string;
}

/**
 * Probe only local capability metadata. This never starts Windows Sandbox,
 * DISM, PowerShell, Hyper-V, a guest process, or a source command. Presence of
 * WindowsSandbox.exe is not enough to claim a usable guest: the feature state
 * and the app-owned guest transport still need an explicit privileged adapter.
 */
export async function probeWindowsDisposableGuest(options: WindowsSandboxProbeOptions = {}): Promise<SourceIsolationStatus> {
  const checkedAt = options.checkedAt?.() ?? new Date().toISOString();
  const platform = options.platform ?? process.platform;
  if (platform !== 'win32') {
    return {
      available: false,
      provider: 'windows-sandbox',
      reason: 'unsupported-platform',
      checkedAt,
      evidence: [`Current platform is ${platform}; the reviewed source runner requires Windows x64.`],
      remediation: 'Run this app on Windows x64 with the separately reviewed disposable guest adapter installed.',
    };
  }
  const systemRoot = options.systemRoot ?? process.env.SystemRoot ?? 'C:\\Windows';
  const executable = path.join(systemRoot, 'System32', 'WindowsSandbox.exe');
  const fileExists = options.fileExists ?? (async (filePath: string) => {
    try { await stat(filePath); return true; } catch { return false; }
  });
  if (!(await fileExists(executable))) {
    return {
      available: false,
      provider: 'windows-sandbox',
      reason: 'sandbox-executable-missing',
      checkedAt,
      evidence: ['The Windows Sandbox host binary was not found. The exact host path stays in the main process.'],
      remediation: 'Enable Windows Sandbox or provide a reviewed disposable guest adapter; never run the recipe on the host.',
    };
  }
  return {
    available: false,
    provider: 'windows-sandbox',
    reason: 'guest-transport-not-connected',
    checkedAt,
    evidence: [
      'WindowsSandbox.exe is present.',
      'Feature state, elevation, guest bootstrap, and whole-process-tree disposal were not claimed from a file-presence check.',
      'Guest transport is not connected to this app build.',
    ],
    remediation: 'Install and register the reviewed disposable guest transport. Until its attestation and cleanup contract are available, source code and OpenCode stay disabled.',
  };
}

export interface WindowsSandboxProtocolPeerContract {
  attest(challenge: Readonly<IsolationAttestationChallenge>, guestId: string, signal: AbortSignal): Promise<unknown>;
  execute(plan: Readonly<SourceExecutionPlan>, bootstrap: Readonly<SourceGuestBootstrap>, emit: (line: RuntimeLine) => void, signal: AbortSignal): Promise<SourceExecutionResult | void>;
  dispose(jobId: string, lease: Readonly<IsolationCapabilityLease>, signal: AbortSignal): Promise<SourceDisposalReceipt>;
  abort(jobId: string, signal: AbortSignal): Promise<void>;
  endpoint?(): Promise<string> | string;
  advertiseAddress?(): string;
  prepare?(challenge: Readonly<IsolationAttestationChallenge>, guestId: string, token: string): Promise<void> | void;
  markProcessTreeStopped?(jobId: string): void;
  markGuestDeleted?(jobId: string): void;
}

interface ProtocolPeerOptions {
  listenHost?: string;
  advertiseAddress?: string;
  maxBodyBytes?: number;
  requestTimeoutMs?: number;
  lifecycleTimeoutMs?: number;
  maxArchiveBytes?: number;
  fetchArchive?: (url: string, maxBytes: number, signal: AbortSignal) => Promise<Buffer>;
}

interface ProtocolPeerJob {
  challenge: IsolationAttestationChallenge;
  guestId: string;
  token: string;
  receiptToken?: string;
  plan?: SourceExecutionPlan;
  guestPlan?: SourceExecutionPlan;
  outputs: Map<string, SourceGuestOutput>;
  manifest?: SourceOutputManifest;
  hello: Promise<unknown>;
  resolveHello: (value: unknown) => void;
  rejectHello: (error: Error) => void;
  complete: Promise<SourceExecutionResult>;
  emit?: (line: RuntimeLine) => void;
  resolveComplete: (value: SourceExecutionResult) => void;
  rejectComplete: (error: Error) => void;
  archive?: Buffer;
  archiveFetched?: Promise<Buffer>;
  processTreeStopped: boolean;
  guestDeleted: boolean;
  disposed: boolean;
  aborted: boolean;
  lifecyclePlan?: GuestLifecyclePlan;
  lifecycleInstallerBytes?: Buffer;
  lifecycleReceipts: GuestLifecycleReceipt[];
  lifecycleFinal?: GuestLifecycleFinalReceipt;
  lifecycleFinalPromise: Promise<GuestLifecycleFinalReceipt>;
  resolveLifecycleFinal: (value: GuestLifecycleFinalReceipt) => void;
  rejectLifecycleFinal: (error: Error) => void;
}

const protocolHelloSchema = z.strictObject({
  protocolVersion: z.literal(SOURCE_GUEST_PROTOCOL_VERSION),
  jobId: z.uuid(),
  challengeNonce: nonceSchema,
  guestId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
  hostMounts: z.literal(0),
  credentialsInjected: z.literal(false),
  secretsInjected: z.literal(false),
  shellStringsAllowed: z.literal(false),
  userProfileMounted: z.literal(false),
});
const protocolCompleteSchema = z.strictObject({ jobId: z.uuid(), ok: z.boolean(), error: z.string().max(1_024).optional() });
const protocolOutputSchema = z.strictObject({
  path: sourceOutputFileSchema.shape.path,
  bytes: z.number().int().min(0).max(SOURCE_RUNTIME_LIMITS.maxOutputBytes),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  contentBase64: z.string().max(Math.ceil(SOURCE_RUNTIME_LIMITS.maxOutputBytes * 4 / 3) + 16),
});

/**
 * The production host-side peer. It owns one ephemeral HTTP listener and one
 * opaque bearer token per guest. Every route is job-bound, nonce-bound, strict
 * schema validated, size bounded, and deadline bounded. It never exposes a
 * host path: source archives are fetched by the broker and output bytes arrive
 * as bounded protocol frames.
 */
export class WindowsSandboxProtocolPeer implements WindowsSandboxProtocolPeerContract {
  private readonly server = createServer((request, response) => { void this.route(request, response); });
  private readonly jobs = new Map<string, ProtocolPeerJob>();
  private readonly options: Required<Pick<ProtocolPeerOptions, 'listenHost' | 'advertiseAddress' | 'maxBodyBytes' | 'requestTimeoutMs' | 'maxArchiveBytes'>> & ProtocolPeerOptions;
  private listening?: Promise<void>;
  private address?: string;

  constructor(options: ProtocolPeerOptions = {}) {
    this.options = {
      listenHost: options.listenHost ?? '0.0.0.0',
      advertiseAddress: options.advertiseAddress ?? '127.0.0.1',
      maxBodyBytes: options.maxBodyBytes ?? 8 * 1024 * 1024,
      requestTimeoutMs: options.requestTimeoutMs ?? 15_000,
      maxArchiveBytes: options.maxArchiveBytes ?? 200 * 1024 * 1024,
      ...options,
    };
    if (!Number.isInteger(this.options.maxBodyBytes) || this.options.maxBodyBytes < 16 * 1024 || this.options.maxBodyBytes > 16 * 1024 * 1024) throw new Error('Protocol body limit is outside the bounded range.');
  }

  async endpoint(): Promise<string> {
    await this.listen();
    return this.address!;
  }

  advertiseAddress(): string { return this.options.advertiseAddress; }

  async close(): Promise<void> {
    for (const jobId of [...this.jobs.keys()]) await this.abort(jobId, new AbortController().signal);
    if (!this.listening) return;
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    this.listening = undefined;
    this.address = undefined;
  }

  private async listen(): Promise<void> {
    if (this.listening) return this.listening;
    this.listening = new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => { this.server.off('listening', onListening); reject(error); };
      const onListening = () => {
        this.server.off('error', onError);
        const address = this.server.address();
        if (!address || typeof address === 'string') { reject(new Error('The protocol listener did not expose a TCP address.')); return; }
        this.address = `http://${this.options.advertiseAddress}:${address.port}`;
        resolve();
      };
      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(0, this.options.listenHost);
    });
    return this.listening;
  }

  prepare(challenge: Readonly<IsolationAttestationChallenge>, guestId: string, token: string): void {
    const parsed = isolationAttestationChallengeSchema.parse(challenge);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(guestId) || !/^[a-f0-9]{48}$/.test(token)) throw new Error('The guest protocol identity or token was malformed.');
    if (this.jobs.has(parsed.jobId)) throw new Error('A protocol peer is already registered for this job.');
    let resolveHello!: (value: unknown) => void;
    let rejectHello!: (error: Error) => void;
    let resolveComplete!: (value: SourceExecutionResult) => void;
    let rejectComplete!: (error: Error) => void;
    const hello = new Promise<unknown>((resolve, reject) => { resolveHello = resolve; rejectHello = reject; });
    const complete = new Promise<SourceExecutionResult>((resolve, reject) => { resolveComplete = resolve; rejectComplete = reject; });
    let resolveLifecycleFinal!: (value: GuestLifecycleFinalReceipt) => void; let rejectLifecycleFinal!: (error: Error) => void;
    const lifecycleFinalPromise = new Promise<GuestLifecycleFinalReceipt>((resolve, reject) => { resolveLifecycleFinal = resolve; rejectLifecycleFinal = reject; });
    // Abort can legitimately happen before a consumer starts awaiting these
    // promises. Attach inert observers so recovery does not create an
    // unhandled rejection while the caller receives the surfaced error.
    void hello.catch(() => undefined); void complete.catch(() => undefined); void lifecycleFinalPromise.catch(() => undefined);
    this.jobs.set(parsed.jobId, { challenge: { ...parsed }, guestId, token, outputs: new Map(), lifecycleReceipts: [], lifecycleFinalPromise, resolveLifecycleFinal, rejectLifecycleFinal, hello, resolveHello, rejectHello, complete, resolveComplete, rejectComplete, processTreeStopped: false, guestDeleted: false, disposed: false, aborted: false });
  }

  /** Publish the separately authenticated installer lifecycle plan. */
  publishLifecyclePlan(jobId: string, plan: GuestLifecyclePlan): void {
    const job = this.jobs.get(jobId); if (!job) throw new Error('Lifecycle job was not registered.');
    const parsed = guestLifecyclePlanSchema.parse(plan);
    if (parsed.jobId !== jobId || parsed.challengeNonce !== job.challenge.nonce || parsed.guestId !== job.guestId) throw new Error('Lifecycle plan binding was rejected.');
    if (parsed.planDigest !== createGuestLifecyclePlanDigest(parsed)) throw new Error('Lifecycle plan digest was rejected.');
    job.lifecyclePlan = parsed;
  }

  publishLifecycleInstaller(jobId: string, bytes: Buffer): void {
    const job = this.jobs.get(jobId); if (!job?.lifecyclePlan) throw new Error('Lifecycle plan was not published.');
    if (bytes.length !== job.lifecyclePlan.installer.bytes || createHash('sha256').update(bytes).digest('hex') !== job.lifecyclePlan.installer.sha256) throw new Error('Installer bytes did not match the lifecycle plan.');
    job.lifecycleInstallerBytes = Buffer.from(bytes);
  }

  lifecycleReceipt(jobId: string): GuestLifecycleFinalReceipt | undefined { return this.jobs.get(jobId)?.lifecycleFinal; }
  async awaitLifecycleFinal(jobId: string, signal: AbortSignal): Promise<GuestLifecycleFinalReceipt> { const job = this.jobs.get(jobId); if (!job) throw new Error('Lifecycle job was not registered.'); const leaseRemainingMs = Math.max(1, Math.min(SOURCE_RUNTIME_LIMITS.maxJobMs, Date.parse(job.challenge.leaseExpiresAt) - Date.now())); const budgetMs = this.options.lifecycleTimeoutMs === undefined ? leaseRemainingMs : Math.min(leaseRemainingMs, Math.max(1_000, this.options.lifecycleTimeoutMs)); return this.withAbort(job.lifecycleFinalPromise, signal, 'Guest lifecycle final receipt timed out.', budgetMs); }

  async attest(challenge: Readonly<IsolationAttestationChallenge>, guestId: string, signal: AbortSignal): Promise<unknown> {
    await this.listen();
    const job = this.jobs.get(challenge.jobId);
    if (!job || job.guestId !== guestId) throw new Error('The guest protocol registration was not found.');
    return await this.withChallengeDeadline(job.hello, signal, challenge.expiresAt, 'Guest hello timed out or was cancelled.');
  }

  async execute(plan: Readonly<SourceExecutionPlan>, bootstrap: Readonly<SourceGuestBootstrap>, emit: (line: RuntimeLine) => void, signal: AbortSignal): Promise<SourceExecutionResult> {
    const job = this.jobs.get(plan.jobId);
    if (!job || job.aborted || job.guestId !== bootstrap.guestId || job.challenge.nonce !== bootstrap.challengeNonce) throw new Error('The guest protocol execution binding was rejected.');
    if (plan.planDigest !== bootstrap.planDigest || plan.protocolVersion !== SOURCE_GUEST_PROTOCOL_VERSION) throw new Error('The guest protocol plan binding was rejected.');
    job.plan = { ...plan };
    job.emit = emit;
    job.guestPlan = { ...plan, sourceArchiveUrl: `${await this.endpoint()}/archive/${plan.jobId}` };
    const result = await this.withAbort(job.complete, signal, 'The guest protocol execution deadline expired or was cancelled.');
    if (result.outputManifest && result.outputManifest.jobId !== plan.jobId) throw new Error('The guest output manifest was bound to another job.');
    return result;
  }

  markProcessTreeStopped(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) job.processTreeStopped = true;
  }

  markGuestDeleted(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) job.guestDeleted = true;
  }

  async dispose(jobId: string, lease: Readonly<IsolationCapabilityLease>, signal: AbortSignal): Promise<SourceDisposalReceipt> {
    const job = this.jobs.get(jobId);
    if (!job || job.aborted || job.challenge.nonce !== lease.challengeNonce) throw new Error('The guest protocol disposal binding was rejected.');
    if (!validateCapabilityLease(lease, job.challenge, 'dispose', Date.now(), true)) throw new Error('The guest protocol disposal lease was invalid.');
    if (!job.processTreeStopped || !job.guestDeleted) throw new Error('Guest disposal is not proven until the host process tree has stopped and the guest/config root is absent.');
    if (job.lifecyclePlan && !job.lifecycleFinal) throw new Error('Guest lifecycle disposal requires the ordered final lifecycle receipt.');
    job.disposed = true;
    const receipt = sourceDisposalReceiptSchema.parse({ schemaVersion: 1, jobId, guestId: job.guestId, brokerId: SOURCE_GUEST_IDENTITY.brokerId, transportId: SOURCE_GUEST_IDENTITY.transportId, challengeNonce: job.challenge.nonce, disposedAt: new Date().toISOString(), processTreeStopped: job.processTreeStopped, guestDeleted: job.guestDeleted, hostMounts: 0, credentialsInjected: false, secretsInjected: false });
    this.jobs.delete(jobId);
    return await this.withAbort(Promise.resolve(receipt), signal, 'Guest disposal receipt timed out.');
  }

  async abort(jobId: string, _signal: AbortSignal): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (!job.aborted) { job.aborted = true; const error = new Error('Guest protocol aborted.'); job.rejectHello(error); job.rejectComplete(error); job.rejectLifecycleFinal(error); }
    // Keep the job record as a recovery handle. The transport removes it only
    // after the host proves the process tree and config root are gone.
  }

  private async withAbort<T>(work: Promise<T>, signal: AbortSignal, message: string, timeoutMs = this.options.requestTimeoutMs): Promise<T> {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    let timer: NodeJS.Timeout | undefined;
    const abort = new Promise<never>((_, reject) => { const onAbort = () => reject(new DOMException('Cancelled', 'AbortError')); signal.addEventListener('abort', onAbort, { once: true }); });
    try { return await Promise.race([work, abort, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), timeoutMs); })]); }
    finally { if (timer) clearTimeout(timer); }
  }

  private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const timer = setTimeout(() => { response.destroy(new Error('Protocol request deadline exceeded.')); }, this.options.requestTimeoutMs);
    try {
      const url = new URL(request.url ?? '/', 'http://protocol.invalid');
      const jobId = url.pathname.split('/')[2];
      const job = jobId ? this.jobs.get(jobId) : undefined;
      if (!job || request.headers['x-ding-ding-protocol'] !== String(SOURCE_GUEST_PROTOCOL_VERSION)) return this.send(response, 401, { error: 'protocol-unauthorized' });
      const receiptRoute = url.pathname === `/stage-receipt/${jobId}` || url.pathname === `/final-receipt/${jobId}`;
      const authorized = receiptRoute ? Boolean(job.receiptToken && request.headers['x-ding-ding-receipt'] === job.receiptToken) : request.headers['x-ding-ding-runner'] === job.token;
      if (!authorized) return this.send(response, 401, { error: 'protocol-unauthorized' });
      if (request.method === 'POST' && url.pathname === `/hello/${jobId}`) return this.handleHello(request, response, job);
      if (request.method === 'GET' && url.pathname === `/plan/${jobId}`) return this.handlePlan(response, job);
      if (request.method === 'GET' && url.pathname === `/archive/${jobId}`) return this.handleArchive(response, job);
      if (request.method === 'GET' && url.pathname === `/lifecycle-plan/${jobId}`) return this.handleLifecyclePlan(response, job);
      if (request.method === 'GET' && url.pathname === `/installer/${jobId}`) return this.handleInstaller(response, job);
      if (request.method === 'POST' && url.pathname === `/event/${jobId}`) return this.handleEvent(request, response, job);
      if (request.method === 'POST' && url.pathname === `/stage-receipt/${jobId}`) return this.handleStageReceipt(request, response, job);
      if (request.method === 'POST' && url.pathname === `/final-receipt/${jobId}`) return this.handleFinalReceipt(request, response, job);
      if (request.method === 'POST' && url.pathname === `/output/${jobId}`) return this.handleOutput(request, response, job);
      if (request.method === 'POST' && url.pathname === `/outputs/${jobId}`) return this.handleManifest(request, response, job);
      if (request.method === 'POST' && url.pathname === `/complete/${jobId}`) return this.handleComplete(request, response, job);
      return this.send(response, 404, { error: 'protocol-route-not-found' });
    } catch (error) { if (!response.headersSent) this.send(response, 400, { error: error instanceof Error ? error.message : 'protocol-request-invalid' }); }
    finally { clearTimeout(timer); }
  }

  private async body(request: IncomingMessage): Promise<unknown> {
    const length = Number(request.headers['content-length'] ?? 0);
    if (!Number.isSafeInteger(length) || length < 0 || length > this.options.maxBodyBytes) throw new Error('Protocol frame exceeded the bounded body limit.');
    const chunks: Buffer[] = []; let total = 0;
    for await (const chunk of request) { const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); total += bytes.length; if (total > this.options.maxBodyBytes) throw new Error('Protocol frame exceeded the bounded body limit.'); chunks.push(bytes); }
    if (!total) throw new Error('Protocol frame was empty.');
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }

  private async handleHello(request: IncomingMessage, response: ServerResponse, job: ProtocolPeerJob): Promise<void> {
    const parsed = protocolHelloSchema.parse(await this.body(request));
    if (parsed.jobId !== job.challenge.jobId || parsed.challengeNonce !== job.challenge.nonce || parsed.guestId !== job.guestId) throw new Error('Guest hello binding was rejected.');
    if (Date.now() > Date.parse(job.challenge.expiresAt) + SOURCE_BROKER_LIMITS.clockSkewMs) throw new Error('Guest hello challenge expired.');
    const now = new Date().toISOString();
    const lease = isolationCapabilityLeaseSchema.parse({ leaseId: randomUUID(), jobId: job.challenge.jobId, challengeNonce: job.challenge.nonce, brokerId: SOURCE_GUEST_IDENTITY.brokerId, transportId: SOURCE_GUEST_IDENTITY.transportId, issuedAt: now, expiresAt: job.challenge.leaseExpiresAt, capabilities: ['execute', 'dispose'] });
    const attestation = isolationAttestationSchema.parse({ ...REQUIRED_ISOLATION, version: 1, jobId: job.challenge.jobId, challengeNonce: job.challenge.nonce, brokerId: SOURCE_GUEST_IDENTITY.brokerId, transportId: SOURCE_GUEST_IDENTITY.transportId, attestedAt: now, expiresAt: job.challenge.expiresAt, lease });
    if (job.receiptToken) throw new Error('Guest hello was replayed; the one-time lifecycle receipt token already exists.');
    job.receiptToken = randomBytes(32).toString('hex');
    job.resolveHello(attestation);
    this.send(response, 200, { ok: true, protocolVersion: SOURCE_GUEST_PROTOCOL_VERSION, jobId: jobIdFrom(job), challengeNonce: job.challenge.nonce, receiptToken: job.receiptToken });
  }

  private handlePlan(response: ServerResponse, job: ProtocolPeerJob): void {
    if (!job.guestPlan) return this.send(response, 425, { error: 'plan-not-ready' });
    this.send(response, 200, job.guestPlan);
  }

  private async handleArchive(response: ServerResponse, job: ProtocolPeerJob): Promise<void> {
    if (!job.plan) return this.send(response, 425, { error: 'plan-not-ready' });
    if (!job.archiveFetched) job.archiveFetched = this.fetchArchive(job.plan.sourceArchiveUrl, job.plan.sourceArchiveSha256, this.options.maxArchiveBytes);
    job.archive = await job.archiveFetched;
    response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': job.archive.length, 'Cache-Control': 'no-store' });
    response.end(job.archive);
  }

  private async withChallengeDeadline<T>(work: Promise<T>, signal: AbortSignal, expiresAt: string, message: string): Promise<T> {
    const timeoutMs = Math.max(1, Date.parse(expiresAt) + SOURCE_BROKER_LIMITS.clockSkewMs - Date.now());
    return this.withAbort(work, signal, message, timeoutMs);
  }

  private handleLifecyclePlan(response: ServerResponse, job: ProtocolPeerJob): void {
    if (!job.lifecyclePlan) return this.send(response, 425, { error: 'lifecycle-plan-not-ready' });
    this.send(response, 200, job.lifecyclePlan);
  }

  private async handleInstaller(response: ServerResponse, job: ProtocolPeerJob): Promise<void> {
    const plan = job.lifecyclePlan; if (!plan) return this.send(response, 425, { error: 'lifecycle-plan-not-ready' });
    const bytes = job.lifecycleInstallerBytes;
    if (!bytes) return this.send(response, 425, { error: 'installer-not-ready' });
    response.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' }); response.end(bytes);
  }

  private async fetchArchive(url: string, digest: string, maxBytes: number): Promise<Buffer> {
    const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !/^\/Ding-Ding-Projects\/[A-Za-z0-9_.-]+\/archive\/[a-f0-9]{40}\.zip$/.test(parsed.pathname)) throw new Error('Source archive origin was not allowlisted.');
    const bytes = this.options.fetchArchive
      ? await this.options.fetchArchive(url, maxBytes, new AbortController().signal)
      : await (async () => { const response = await fetch(url, { redirect: 'error' }); if (!response.ok || !response.body) throw new Error(`Source archive fetch failed (${response.status}).`); return Buffer.from(await response.arrayBuffer()); })();
    if (bytes.length > maxBytes) throw new Error('Source archive exceeded the bounded transfer size.');
    if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('Source archive SHA-256 did not match the reviewed plan.');
    return bytes;
  }

  private async handleEvent(request: IncomingMessage, response: ServerResponse, job: ProtocolPeerJob): Promise<void> { const parsed = runtimeLineSchema.parse(await this.body(request)); job.emit?.(parsed); if (parsed.state === 'failed' || parsed.state === 'cancelled') job.rejectComplete(new Error(parsed.text)); this.send(response, 200, { ok: true }); }

  private async handleStageReceipt(request: IncomingMessage, response: ServerResponse, job: ProtocolPeerJob): Promise<void> {
    const parsed = guestLifecycleReceiptSchema.parse(await this.body(request));
    if (!job.lifecyclePlan || parsed.jobId !== job.challenge.jobId || parsed.challengeNonce !== job.challenge.nonce || parsed.guestId !== job.guestId || parsed.planDigest !== job.lifecyclePlan.planDigest) throw new Error('Lifecycle receipt binding was rejected.');
    if (parsed.sequence !== job.lifecycleReceipts.length + 1) throw new Error('Lifecycle receipt sequence was skipped or replayed.');
    if (parsed.stage === 'launch' && !parsed.process) throw new Error('Launch receipt omitted inner-app readiness facts.');
    if (parsed.stage === 'launch' && (parsed.installedIdentity !== job.lifecyclePlan.installIdentity || parsed.installedVersion !== job.lifecyclePlan.expectedVersion || parsed.executableSha256 !== job.lifecyclePlan.executableSha256)) throw new Error('Launch receipt identity or executable digest did not match the reviewed plan.');
    if (parsed.stage === 'uninstall' && parsed.uninstallSucceeded !== true) throw new Error('Uninstall receipt did not prove success.');
    if (parsed.stage === 'absence' && parsed.absenceVerified !== true) throw new Error('Uninstall absence was not proven.');
    if (parsed.stage === 'disposal' && parsed.childProcessesStopped !== true) throw new Error('Disposal receipt did not prove child-process stop.');
    job.lifecycleReceipts.push(parsed); this.send(response, 200, { ok: true, sequence: parsed.sequence });
  }

  private async handleFinalReceipt(request: IncomingMessage, response: ServerResponse, job: ProtocolPeerJob): Promise<void> {
    const parsed = guestLifecycleFinalReceiptSchema.parse(await this.body(request));
    if (!job.lifecyclePlan || parsed.jobId !== job.challenge.jobId || parsed.challengeNonce !== job.challenge.nonce || parsed.guestId !== job.guestId || parsed.planDigest !== job.lifecyclePlan.planDigest) throw new Error('Final lifecycle receipt binding was rejected.');
    if (parsed.lastSequence !== job.lifecycleReceipts.length || parsed.lastSequence < 1) throw new Error('Final lifecycle receipt sequence was not complete.');
    const expectedStages = ['installer-bytes', 'install', 'launch', 'uninstall', 'absence', 'disposal'];
    if (job.lifecycleReceipts.length !== expectedStages.length || job.lifecycleReceipts.some((receipt, index) => receipt.stage !== expectedStages[index])) throw new Error('Final lifecycle receipt omitted an ordered lifecycle stage.');
    if (!job.lifecycleReceipts.some((receipt) => receipt.stage === 'disposal' && receipt.childProcessesStopped)) throw new Error('Final lifecycle receipt claimed disposal without child-process proof.');
    job.lifecycleFinal = parsed; job.resolveLifecycleFinal(parsed); this.send(response, 200, { ok: true });
  }

  private async handleOutput(request: IncomingMessage, response: ServerResponse, job: ProtocolPeerJob): Promise<void> {
    const parsed = protocolOutputSchema.parse(await this.body(request));
    const content = Buffer.from(parsed.contentBase64, 'base64'); if (content.length !== parsed.bytes || createHash('sha256').update(content).digest('hex') !== parsed.sha256) throw new Error('Guest output bytes did not match the declared manifest entry.');
    if (content.length > SOURCE_RUNTIME_LIMITS.maxOutputBytes || [...job.outputs.values()].reduce((sum, item) => sum + item.bytes, 0) + content.length > SOURCE_RUNTIME_LIMITS.maxOutputBytes) throw new Error('Guest output exceeded the bounded byte budget.');
    job.outputs.set(parsed.path, { path: parsed.path, bytes: parsed.bytes, sha256: parsed.sha256, content }); this.send(response, 200, { ok: true });
  }

  private async handleManifest(request: IncomingMessage, response: ServerResponse, job: ProtocolPeerJob): Promise<void> { const parsed = sourceOutputManifestSchema.parse(await this.body(request)); if (parsed.jobId !== job.challenge.jobId) throw new Error('Guest output manifest job mismatch.'); job.manifest = parsed; this.send(response, 200, { ok: true }); }

  private async handleComplete(request: IncomingMessage, response: ServerResponse, job: ProtocolPeerJob): Promise<void> { const parsed = protocolCompleteSchema.parse(await this.body(request)); if (parsed.jobId !== job.challenge.jobId) throw new Error('Guest completion job mismatch.'); if (!parsed.ok) { job.rejectComplete(new Error(parsed.error ?? 'Guest execution failed.')); } else if (!job.plan || !job.manifest) { job.rejectComplete(new Error('Guest completion omitted the output manifest.')); } else { const outputs = [...job.outputs.values()]; const outputPaths = new Set(outputs.map((file) => file.path)); if (job.plan.finalOutputs.some((file) => !outputPaths.has(file))) throw new Error('Guest completion omitted a reviewed final output.'); const manifest = sourceOutputManifestSchema.parse({ ...job.manifest, appId: job.plan.appId, revision: job.plan.revision, decision: job.plan.decision, totalBytes: outputs.reduce((sum, file) => sum + file.bytes, 0), files: outputs.map(({ content: _content, ...file }) => file) }); job.resolveComplete({ outputManifest: manifest, outputs, guestId: job.guestId }); } this.send(response, 200, { ok: true }); }

  private send(response: ServerResponse, status: number, body: unknown): void { if (response.headersSent) return; const payload = Buffer.from(JSON.stringify(body), 'utf8'); response.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': payload.length, 'Cache-Control': 'no-store' }); response.end(payload); }
}

function jobIdFrom(job: ProtocolPeerJob): string { return job.challenge.jobId; }

export interface WindowsSandboxTransportOptions {
  systemRoot?: string;
  appDataRoot?: string;
  platform?: NodeJS.Platform;
  fileExists?: (filePath: string) => Promise<boolean>;
  protocol?: WindowsSandboxProtocolPeerContract;
  /** Ephemeral host endpoint created by the protocol adapter; never persisted. */
  endpoint?: string;
  advertiseAddress?: string;
  launch?: (executable: string, configPath: string, signal: AbortSignal) => Promise<{ stop(): Promise<{ processTreeStopped: boolean; rootPid?: number }> }>;
  recoverOrphan?: (jobId: string, configPath: string) => Promise<boolean>;
  checkedAt?: () => string;
}

interface LiveGuest {
  guestId: string;
  challenge: IsolationAttestationChallenge;
  configPath: string;
  stop(): Promise<{ processTreeStopped: boolean; rootPid?: number }>;
}

function isExplicitNonLoopbackIpv4(value: unknown): value is string {
  if (typeof value !== 'string' || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value.trim())) return false;
  const octets = value.split('.').map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return false;
  return octets[0] !== 0 && octets[0] !== 127 && !(octets[0] === 169 && octets[1] === 254) && octets[0] < 224;
}

/**
 * Concrete Windows Sandbox transport. It launches a .wsb document with no
 * mapped folders, disabled clipboard/audio/video channels and ProtectedClient
 * enabled. Source bytes and output files cross only the nonce-bound guest
 * protocol; the host never exposes its profile, secrets or a repository path.
 * Without a protocol peer this class remains fail-closed.
 */
export class WindowsSandboxGuestTransport implements IsolationBroker {
  private readonly guests = new Map<string, LiveGuest>();
  constructor(private readonly options: WindowsSandboxTransportOptions = {}) {}

  identity(): IsolationBrokerIdentity | null { return this.options.protocol ? SOURCE_GUEST_IDENTITY : null; }

  async recoverOrphans(): Promise<string[]> {
    const root = this.options.appDataRoot;
    if (!root || !this.options.recoverOrphan) return [];
    const recovered: string[] = [];
    let entries: string[];
    try { entries = await readdir(root); } catch { return recovered; }
    for (const name of entries) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.wsb$/i.test(name)) continue;
      const jobId = name.slice(0, -4);
      const configPath = path.join(root, name);
      try {
        if (await this.options.recoverOrphan(jobId, configPath)) { await rm(configPath, { force: true }); recovered.push(jobId); }
      } catch { /* Preserve an unproven orphan for the next startup recovery pass. */ }
    }
    return recovered;
  }

  async diagnose(): Promise<SourceIsolationStatus> {
    const base = await probeWindowsDisposableGuest(this.options);
    if (!base.evidence || base.reason !== 'guest-transport-not-connected') return base;
    const advertiseAddress = this.options.advertiseAddress ?? this.options.protocol?.advertiseAddress?.();
    if (!this.options.protocol || !isExplicitNonLoopbackIpv4(advertiseAddress)) return base;
    const endpoint = this.options.endpoint ?? (this.options.protocol.endpoint ? await this.options.protocol.endpoint() : undefined);
    if (!endpoint || !/^https?:\/\/[^\s/]+(?::\d{1,5})?$/.test(endpoint)) return base;
    return { available: true, provider: 'windows-sandbox', reason: 'ready', checkedAt: base.checkedAt, evidence: [...base.evidence, 'The fixed zero-host-mount guest protocol peer is configured.', 'The guest bootstrap refuses host mounts, credentials, secrets and shell strings.'], remediation: 'Source execution may proceed only after the per-job guest attestation and disposal receipt validate.' };
  }

  private async launchGuest(challenge: Readonly<IsolationAttestationChallenge>, signal: AbortSignal): Promise<LiveGuest> {
    const root = this.options.appDataRoot ?? path.join(process.env.LOCALAPPDATA ?? process.env.TEMP ?? '.', 'DingDingAppStore', 'source-jobs');
    await mkdir(root, { recursive: true });
    const guestId = `guest-${challenge.jobId}`;
    const configPath = path.join(root, `${challenge.jobId}.wsb`);
    const token = randomBytes(24).toString('hex');
    const endpoint = this.options.endpoint ?? (this.options.protocol?.endpoint ? await this.options.protocol.endpoint() : undefined);
    if (!endpoint) throw new Error('The zero-mount guest protocol has no ephemeral endpoint.');
    this.options.protocol?.prepare?.(challenge, guestId, token);
    const argsPayload = Buffer.from(JSON.stringify([challenge.jobId, challenge.nonce, endpoint, token]), 'utf8').toString('base64');
    const script = `$runnerArgs = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${argsPayload}')) | ConvertFrom-Json\n${WINDOWS_SANDBOX_GUEST_BOOTSTRAP}`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const command = `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`;
    await writeFile(configPath, createZeroMountSandboxConfig(command), { encoding: 'utf8', flag: 'wx' });
    const launch = this.options.launch ?? (async (executable: string, file: string, abortSignal: AbortSignal) => {
      const child = spawn(executable, [file], { windowsHide: true, stdio: 'ignore' });
      const stop = async () => { if (child.pid && process.platform === 'win32') { const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); const code = await new Promise<number>((resolve) => { killer.once('exit', (exitCode) => resolve(exitCode ?? 1)); killer.once('error', () => resolve(1)); }); const exited = child.exitCode !== null || await new Promise<boolean>((resolve) => { const timer = setTimeout(() => resolve(child.exitCode !== null), 10_000); child.once('exit', () => { clearTimeout(timer); resolve(true); }); }); return { processTreeStopped: (code === 0 || child.exitCode !== null) && exited, rootPid: child.pid }; } else if (!child.killed) { child.kill(); return { processTreeStopped: true, rootPid: child.pid }; } return { processTreeStopped: true, rootPid: child.pid }; };
      if (abortSignal.aborted) await stop(); else abortSignal.addEventListener('abort', () => { void stop(); }, { once: true });
      return { stop };
    });
    const executable = path.join(this.options.systemRoot ?? process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsSandbox.exe');
    const processHandle = await launch(executable, configPath, signal);
    const guest = { guestId, challenge: { ...challenge }, configPath, stop: processHandle.stop };
    this.guests.set(challenge.jobId, guest);
    return guest;
  }

  async attest(challenge: Readonly<IsolationAttestationChallenge>, signal: AbortSignal): Promise<unknown> {
    if (!this.options.protocol || !(await this.diagnose()).available) return null;
    const guest = await this.launchGuest(challenge, signal);
    try { return await this.options.protocol.attest(challenge, guest.guestId, signal); } catch (error) { await this.abort(challenge.jobId); throw error; }
  }

  async execute(plan: Readonly<SourceExecutionPlan>, emit: (line: RuntimeLine) => void, signal: AbortSignal, _lease: Readonly<IsolationCapabilityLease>): Promise<SourceExecutionResult | void> {
    const guest = this.guests.get(plan.jobId);
    if (!guest || !this.options.protocol) throw new Error('The zero-mount guest protocol is not connected.');
    const bootstrap = createGuestBootstrap(plan, guest.challenge.nonce, guest.guestId);
    if (!validateGuestBootstrap(bootstrap, plan, guest.challenge)) throw new Error('The guest bootstrap binding was rejected.');
    return this.options.protocol.execute(plan, bootstrap, emit, signal);
  }

  async executeLifecycle(plan: GuestLifecyclePlan, installerBytes: Buffer, signal: AbortSignal): Promise<{ guest: GuestLifecycleFinalReceipt; disposal: SourceDisposalReceipt }> {
    if (!this.options.protocol || this.options.platform === 'linux' || this.options.platform === 'darwin') throw new Error('Disposable guest lifecycle requires the configured Windows protocol peer.');
    const advertiseAddress = this.options.advertiseAddress ?? this.options.protocol.advertiseAddress?.();
    if (!isExplicitNonLoopbackIpv4(advertiseAddress)) throw new Error('Live Sandbox lifecycle requires an explicit non-loopback advertise address.');
    const endpoint = this.options.endpoint ?? (this.options.protocol.endpoint ? await this.options.protocol.endpoint() : undefined);
    if (!endpoint) throw new Error('The zero-mount guest protocol has no ephemeral endpoint.');
    const now = new Date().toISOString();
    const challenge = isolationAttestationChallengeSchema.parse({ version: 1, jobId: plan.jobId, nonce: plan.challengeNonce, issuedAt: now, expiresAt: new Date(Date.now() + SOURCE_BROKER_LIMITS.challengeTtlMs).toISOString(), leaseExpiresAt: new Date(Date.now() + SOURCE_RUNTIME_LIMITS.maxJobMs).toISOString(), requestedCapabilities: ['execute', 'dispose'], expectedBrokerId: SOURCE_GUEST_IDENTITY.brokerId, expectedTransportId: SOURCE_GUEST_IDENTITY.transportId });
    let guest: GuestLifecycleFinalReceipt | undefined;
    try {
      const attestation = isolationAttestationSchema.parse(await this.attest(challenge, signal));
      const peer = this.options.protocol as WindowsSandboxProtocolPeerContract & { publishLifecyclePlan?: (jobId: string, value: GuestLifecyclePlan) => void; publishLifecycleInstaller?: (jobId: string, bytes: Buffer) => void; awaitLifecycleFinal?: (jobId: string, signal: AbortSignal) => Promise<GuestLifecycleFinalReceipt> };
      peer.publishLifecyclePlan?.(plan.jobId, plan); peer.publishLifecycleInstaller?.(plan.jobId, installerBytes);
      const final = peer.awaitLifecycleFinal ? await peer.awaitLifecycleFinal(plan.jobId, signal) : (() => { throw new Error('Protocol peer lacks lifecycle final receipt wait.'); })();
      guest = guestLifecycleFinalReceiptSchema.parse(final);
      const disposal = await this.dispose(plan.jobId, attestation.lease);
      return { guest, disposal };
    } catch (error) {
      await this.abort(plan.jobId);
      throw error;
    }
  }

  async dispose(jobId: string, lease: Readonly<IsolationCapabilityLease>): Promise<SourceDisposalReceipt> {
    const guest = this.guests.get(jobId);
    if (!guest || !this.options.protocol) throw new Error('No admitted zero-mount guest is available for disposal.');
    let completed = false;
    try {
      const stopped = await guest.stop();
      if (!stopped.processTreeStopped) throw new Error('Host Sandbox process-tree stop was not proven.');
      this.options.protocol.markProcessTreeStopped?.(jobId);
      await rm(guest.configPath, { force: false });
      try { await stat(guest.configPath); throw new Error('The Sandbox config recovery handle remained after host disposal.'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      this.options.protocol.markGuestDeleted?.(jobId);
      const receipt = sourceDisposalReceiptSchema.parse(await this.options.protocol.dispose(jobId, lease, new AbortController().signal));
      if (receipt.jobId !== jobId || receipt.challengeNonce !== guest.challenge.nonce || receipt.guestId !== guest.guestId || receipt.hostMounts !== 0 || !receipt.processTreeStopped || !receipt.guestDeleted) throw new Error('The guest disposal receipt did not prove complete teardown.');
      completed = true;
      return receipt;
    } finally { if (completed) this.guests.delete(jobId); }
  }

  async abort(jobId: string): Promise<void> {
    const guest = this.guests.get(jobId); if (!guest) return;
    if (this.options.protocol) await this.options.protocol.abort(jobId, new AbortController().signal);
    const stopped = await guest.stop();
    if (!stopped.processTreeStopped) throw new Error('Guest abort could not prove the host process tree stopped; recovery state was retained.');
    await rm(guest.configPath, { force: false });
    this.options.protocol?.markProcessTreeStopped?.(jobId);
    this.options.protocol?.markGuestDeleted?.(jobId);
    this.guests.delete(jobId);
  }
}

/**
 * Safe production adapter while the guest transport is absent. It exposes a
 * truthful capability report and fails closed; it deliberately has no host
 * process execution fallback. A future runner may be injected only after it
 * supplies the full attestation and disposal contract through IsolationBroker.
 */
export class WindowsSandboxIsolationBroker implements IsolationBroker {
  constructor(private readonly probe: () => Promise<SourceIsolationStatus> = () => probeWindowsDisposableGuest()) {}

  async diagnose(): Promise<SourceIsolationStatus> { return this.probe(); }

  async attest(_challenge: Readonly<IsolationAttestationChallenge>, _signal: AbortSignal): Promise<null> {
    await this.probe();
    return null;
  }

  async execute(): Promise<void> {
    const status = await this.probe();
    throw new Error(`Disposable Windows source execution is unavailable (${status.reason}). Source code was not executed on the host.`);
  }

  async dispose(): Promise<void> { /* No guest was started by this fail-closed adapter. */ }
  async abort(): Promise<void> { /* No pre-attestation guest exists. */ }
}

export class UnavailableIsolationBroker implements IsolationBroker {
  async attest(_challenge: Readonly<IsolationAttestationChallenge>, _signal: AbortSignal): Promise<null> { return null; }
  async execute(): Promise<void> { throw new Error('A reviewed hard-disposable source runner is not available. Source code was not executed on the host.'); }
  async dispose(): Promise<void> { /* No guest exists. */ }
  async abort(): Promise<void> { /* No guest exists. */ }
  async diagnose(): Promise<SourceIsolationStatus> {
    return {
      available: false,
      provider: 'windows-sandbox',
      reason: 'guest-transport-not-connected',
      checkedAt: new Date().toISOString(),
      evidence: ['No source runner was configured for this app process.'],
      remediation: 'Keep source execution disabled until a reviewed disposable guest transport is connected.',
    };
  }
}

export function isolationMatches(attestation: IsolationRequirements | IsolationAttestation | null): boolean {
  return Boolean(attestation && Object.entries(REQUIRED_ISOLATION).every(([key, value]) => (attestation as IsolationRequirements)[key as keyof IsolationRequirements] === value));
}

export function createOpenCodeConfig(): Readonly<Record<string, unknown>> {
  return Object.freeze({
    $schema: 'https://opencode.ai/config.json',
    share: 'disabled',
    permission: 'allow',
    instructions: [],
    mcp: {},
    plugin: [],
    autoupdate: false,
    snapshot: false,
    lsp: false,
  });
}

export function createRepairPrompt(step: SourceStep, boundedOutput: string, attempt: number): string {
  const output = sanitizeTerminalText(boundedOutput, '').slice(0, 12_000);
  return [
    `Repair attempt ${attempt} of ${SOURCE_RUNTIME_LIMITS.maxRepairAttempts} for reviewed step ${step.id}.`,
    `The exact failing command is ${JSON.stringify([step.executable, ...step.arguments])}; working directory is ${step.cwd}.`,
    'Work only inside this disposable workspace. Make the smallest source edit needed to fix this exact failure.',
    'Do not force-push, switch branches, create commits, push, access external paths, read secrets, replace pinned dependencies, alter the reviewed command, or expand scope.',
    'Do not ask questions. Do not start an interactive shell. The caller will diff your edits and rerun the exact failing step.',
    'Bounded failing output follows:',
    output,
  ].join('\n');
}

export function createSourceExecutionPlan(jobId: string, decision: SourceJobDecision, recipe: SourceRecipe): SourceExecutionPlan {
  const selected = decision === 'build'
    ? [...recipe.prepare, ...recipe.validate, ...recipe.build, ...recipe.test]
    : [...recipe.prepare, ...recipe.validate, ...recipe.run];
  const plan = {
    jobId,
    appId: recipe.appId,
    decision,
    workspaceName: `source-job-${jobId}`,
    sourceArchiveUrl: `https://github.com/${recipe.repository}/archive/${recipe.revision}.zip`,
    sourceArchiveSha256: recipe.sourceArchiveSha256,
    revision: recipe.revision,
    dependencies: recipe.dependencies,
    steps: selected,
    readiness: recipe.readiness,
    repairableStepIds: recipe.repairableStepIds,
    finalOutputs: recipe.finalOutputs,
    repairAttempts: recipe.repairAttempts,
    openCode: PINNED_OPENCODE,
    openCodeConfig: createOpenCodeConfig(),
    openCodeArguments: ['run', '--auto'] as const,
    forbiddenRepairEntries: ['.git', '.opencode', 'opencode.json', 'opencode.jsonc', 'AGENTS.md', 'CLAUDE.md'],
    protocolVersion: SOURCE_GUEST_PROTOCOL_VERSION,
    policy: SOURCE_GUEST_POLICY,
    planDigest: '',
  };
  const planDigest = createPlanDigest(plan);
  return Object.freeze({ ...plan, planDigest });
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
}

export function createPlanDigest(plan: Omit<SourceExecutionPlan, 'planDigest'> | SourceExecutionPlan): string {
  const { planDigest: _ignored, ...unsigned } = plan as SourceExecutionPlan;
  return createHash('sha256').update(stableJson(unsigned)).digest('hex');
}

export function createGuestBootstrap(plan: Readonly<SourceExecutionPlan>, challengeNonce: string, guestId: string): SourceGuestBootstrap {
  if (!nonceSchema.safeParse(challengeNonce).success) throw new Error('Guest bootstrap requires the attestation nonce.');
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(guestId)) throw new Error('Guest bootstrap requires a bounded guest identity.');
  if (plan.planDigest !== createPlanDigest(plan)) throw new Error('Guest bootstrap rejected a plan with a stale digest.');
  return Object.freeze({ protocolVersion: SOURCE_GUEST_PROTOCOL_VERSION, jobId: plan.jobId, challengeNonce, guestId, brokerId: SOURCE_GUEST_IDENTITY.brokerId, transportId: SOURCE_GUEST_IDENTITY.transportId, planDigest: plan.planDigest, policy: SOURCE_GUEST_POLICY });
}

export function validateGuestBootstrap(input: unknown, plan: Readonly<SourceExecutionPlan>, challenge: Readonly<IsolationAttestationChallenge>): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const value = input as Record<string, unknown>;
  if (value.protocolVersion !== SOURCE_GUEST_PROTOCOL_VERSION || value.jobId !== plan.jobId || value.challengeNonce !== challenge.nonce || value.planDigest !== plan.planDigest || value.brokerId !== challenge.expectedBrokerId || value.transportId !== challenge.expectedTransportId) return false;
  if (!isolationMatches(value.policy as IsolationRequirements) || !value.policy || (value.policy as Record<string, unknown>).clipboardRedirection !== false || (value.policy as Record<string, unknown>).protectedClient !== true) return false;
  return typeof value.guestId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value.guestId);
}

const SECRET_PATTERNS = [
  /\b(?:ghp_|github_pat_|sk-|xox[baprs]-)[-A-Za-z0-9_]{8,}\b/gi,
  /\b(?:token|password|passwd|secret|authorization)\s*[:=]\s*[^\s]+/gi,
  /https?:\/\/[^\s/@:]+:[^\s/@]+@/gi,
];

function redactTerminalText(input: string, workspaceRoot: string): string {
  let value = input
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/\r\n?/g, '\n');
  if (workspaceRoot) value = value.replaceAll(workspaceRoot, '[workspace]').replaceAll(workspaceRoot.replaceAll('\\', '/'), '[workspace]');
  value = value.replace(/[A-Za-z]:\\Users\\[^\\\s]+/gi, '[user-profile]');
  value = value.replace(/\b(authorization\s*:\s*(?:bearer|basic)\s+)\S+/gi, '$1[redacted]');
  for (const pattern of SECRET_PATTERNS) value = value.replace(pattern, '[redacted]');
  return value;
}

export function sanitizeTerminalText(input: string, workspaceRoot: string): string {
  return Buffer.from(redactTerminalText(input, workspaceRoot), 'utf8').subarray(0, SOURCE_RUNTIME_LIMITS.maxEventBytes).toString('utf8');
}

export class TerminalEventBudget {
  private sequence = 0;
  private bytes = 0;
  private finalEmitted = false;
  private carry = '';

  constructor(private readonly jobId: string, private readonly appId: string, private readonly workspaceRoot: string) {}

  next(line: RuntimeLine, final = false): SourceTerminalEvent | null {
    if (this.finalEmitted) return null;
    if (!final && (this.sequence >= SOURCE_RUNTIME_LIMITS.maxEvents || this.bytes >= SOURCE_RUNTIME_LIMITS.maxOutputBytes)) return null;
    const combined = this.carry + line.text;
    let framed: string;
    if (final) {
      framed = combined;
      this.carry = '';
    } else {
      const boundary = combined.lastIndexOf('\n');
      if (boundary >= 0) {
        framed = combined.slice(0, boundary + 1);
        this.carry = combined.slice(boundary + 1);
      } else if (combined.length > SOURCE_RUNTIME_LIMITS.maxEventBytes * 2) {
        framed = redactTerminalText(combined, this.workspaceRoot);
        this.carry = '';
      } else {
        this.carry = combined;
        return null;
      }
    }
    const text = sanitizeTerminalText(framed, this.workspaceRoot);
    if (!final) {
      this.bytes += Buffer.byteLength(text, 'utf8');
      if (this.bytes > SOURCE_RUNTIME_LIMITS.maxOutputBytes) return null;
    } else {
      this.finalEmitted = true;
    }
    return Object.freeze({
      jobId: this.jobId,
      appId: this.appId,
      sequence: this.sequence++,
      at: new Date().toISOString(),
      stream: line.stream,
      state: line.state,
      text,
      progress: line.progress == null ? null : Math.max(0, Math.min(100, Math.round(line.progress))),
      final,
    });
  }
}

export function resolveOwnedPath(root: string, candidate: string): string {
  const ownedRoot = path.resolve(root);
  const resolved = path.resolve(ownedRoot, candidate);
  const relative = path.relative(ownedRoot, resolved);
  if (!relative || relative === '.') return resolved;
  if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw new Error('Path escaped the app-owned disposable workspace.');
  return resolved;
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).toLocaleLowerCase() === path.resolve(right).toLocaleLowerCase();
}

export async function verifyOwnedRoot(root: string): Promise<string> {
  const parentReal = await realpath(path.dirname(root));
  const metadata = await lstat(root);
  if (metadata.isSymbolicLink()) throw new Error('The app-owned source root cannot be a symbolic link or junction.');
  const rootReal = await realpath(root);
  const expected = path.join(parentReal, path.basename(root));
  if (!samePath(rootReal, expected)) throw new Error('The app-owned source root escaped its canonical application-data parent.');
  return rootReal;
}

export async function verifyOwnedDirectChild(root: string, childName: string): Promise<string> {
  if (path.basename(childName) !== childName || childName === '.' || childName === '..') throw new Error('Owned child name must be one direct path segment.');
  const rootReal = await verifyOwnedRoot(root);
  const target = path.join(rootReal, childName);
  const metadata = await lstat(target);
  if (metadata.isSymbolicLink()) throw new Error('The app-owned job directory cannot be a symbolic link or junction.');
  const targetReal = await realpath(target);
  if (!samePath(path.dirname(targetReal), rootReal)) throw new Error('The app-owned job directory escaped its canonical root.');
  return targetReal;
}

export async function rejectSymlinkEscape(root: string, candidate: string): Promise<string> {
  const resolved = resolveOwnedPath(root, candidate);
  const rootReal = await realpath(root);
  const parts = path.relative(root, resolved).split(path.sep).filter(Boolean);
  let cursor = root;
  for (const part of parts) {
    cursor = path.join(cursor, part);
    const metadata = await lstat(cursor);
    if (metadata.isSymbolicLink()) throw new Error('Symbolic links are not allowed in source job paths.');
  }
  const targetReal = await realpath(resolved);
  resolveOwnedPath(rootReal, path.relative(rootReal, targetReal));
  return targetReal;
}

export async function validateWorkspaceTree(root: string): Promise<void> {
  let fileCount = 0;
  let totalBytes = 0;
  const walk = async (directory: string, depth: number): Promise<void> => {
    if (depth > SOURCE_RUNTIME_LIMITS.maxWorkspaceDepth) throw new Error('Workspace tree exceeded the maximum depth.');
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['.git', '.opencode', 'opencode.json', 'opencode.jsonc'].includes(entry.name.toLocaleLowerCase())) throw new Error(`Untrusted OpenCode or Git configuration is not allowed in the disposable repair workspace: ${entry.name}`);
      const absolute = resolveOwnedPath(root, path.relative(root, path.join(directory, entry.name)));
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link is not allowed: ${entry.name}`);
      if (entry.isDirectory()) await walk(absolute, depth + 1);
      else {
        fileCount += 1;
        totalBytes += (await stat(absolute)).size;
        if (fileCount > SOURCE_RUNTIME_LIMITS.maxWorkspaceFiles) throw new Error('Workspace tree exceeded the maximum file count.');
        if (totalBytes > SOURCE_RUNTIME_LIMITS.maxWorkspaceBytes) throw new Error('Workspace tree exceeded the maximum byte count.');
      }
    }
  };
  await walk(root, 0);
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', resolve);
  });
  return hash.digest('hex');
}

export async function validateOpenCodeArchive(filePath: string): Promise<boolean> {
  return await sha256File(filePath) === PINNED_OPENCODE.sha256;
}

export async function validateOpenCodeExecutable(filePath: string, runVersion: (filePath: string) => Promise<string>): Promise<boolean> {
  if (await sha256File(filePath) !== PINNED_OPENCODE.executableSha256) return false;
  const version = (await runVersion(filePath)).trim().replace(/^v/, '');
  return version === PINNED_OPENCODE.version;
}

export interface OpenCodeBootstrapOptions {
  workspaceRoot: string;
  /** The tool directory is always one direct child of the app-owned workspace. */
  toolDirectory?: string;
  downloadArchive(url: string, destination: string, signal: AbortSignal): Promise<void>;
  runVersion(filePath: string, signal: AbortSignal): Promise<string>;
  signal?: AbortSignal;
}

/**
 * Resolve or install the pinned OpenCode executable inside the disposable guest.
 * No PATH lookup, shell invocation, overwrite of an invalid executable, or host
 * profile path is allowed. A broker may call this only after attesting isolation.
 */
export async function ensurePinnedOpenCode(options: OpenCodeBootstrapOptions): Promise<string> {
  const signal = options.signal ?? new AbortController().signal;
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const workspaceRoot = await verifyOwnedRoot(options.workspaceRoot);
  const toolDirectory = options.toolDirectory ?? '.opencode-tool';
  if (path.basename(toolDirectory) !== toolDirectory || toolDirectory === '.' || toolDirectory === '..' || toolDirectory.includes('\0')) {
    throw new Error('OpenCode tool directory must be one bounded workspace child.');
  }
  const toolRoot = resolveOwnedPath(workspaceRoot, toolDirectory);
  await mkdir(toolRoot, { recursive: false }).catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  });
  const verifiedRoot = await verifyOwnedDirectChild(workspaceRoot, toolDirectory);
  const executable = resolveOwnedPath(verifiedRoot, PINNED_OPENCODE.executable);
  try {
    if ((await lstat(executable)).isSymbolicLink()) throw new Error('OpenCode executable cannot be a symbolic link.');
    if (await validateOpenCodeExecutable(executable, (file) => options.runVersion(file, signal))) return executable;
    throw new Error(`Existing OpenCode executable is not the pinned ${PINNED_OPENCODE.version} build.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const archive = resolveOwnedPath(verifiedRoot, `${PINNED_OPENCODE.assetName}.download`);
  try {
    try {
      if ((await lstat(archive)).isSymbolicLink()) throw new Error('OpenCode download target cannot be a symbolic link.');
      await rm(archive, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    await options.downloadArchive(PINNED_OPENCODE.url, archive, signal);
    if (!(await validateOpenCodeArchive(archive))) throw new Error('Downloaded OpenCode archive failed the pinned SHA-256 check.');
    await extractZipSafe(archive, verifiedRoot, signal);
    if (!(await lstat(executable)).isFile()) throw new Error('Pinned OpenCode archive did not contain the expected executable.');
    if (!(await validateOpenCodeExecutable(executable, (file) => options.runVersion(file, signal)))) throw new Error('Extracted OpenCode executable failed the pinned version or SHA-256 check.');
    return executable;
  } finally {
    await rm(archive, { force: true }).catch(() => undefined);
  }
}

export function isolatedEnvironment(workspaceRoot: string, toolRoot: string): NodeJS.ProcessEnv {
  return {
    DING_DING_ISOLATED_RUNNER: 'hard-disposable-v1',
    HOME: path.join(workspaceRoot, '.home'),
    USERPROFILE: path.join(workspaceRoot, '.home'),
    APPDATA: path.join(workspaceRoot, '.appdata'),
    LOCALAPPDATA: path.join(workspaceRoot, '.localappdata'),
    TEMP: path.join(workspaceRoot, '.temp'),
    TMP: path.join(workspaceRoot, '.temp'),
    PATH: toolRoot,
    NO_COLOR: '1',
    CI: '1',
  };
}

export interface ProcessResult { code: number; output: string; timedOut: boolean; cancelled: boolean }

interface FileSnapshot { hash: string; bytes: number }

async function snapshotWorkspace(root: string): Promise<Map<string, FileSnapshot>> {
  await validateWorkspaceTree(root);
  const snapshot = new Map<string, FileSnapshot>();
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = resolveOwnedPath(root, path.relative(root, path.join(directory, entry.name)));
      if (entry.isDirectory()) await walk(absolute);
      else {
        const info = await stat(absolute);
        snapshot.set(path.relative(root, absolute).replaceAll('\\', '/'), { hash: await sha256File(absolute), bytes: info.size });
      }
    }
  };
  await walk(root);
  return snapshot;
}

async function withAbortAndTimeout<T>(work: (signal: AbortSignal) => Promise<T>, signal: AbortSignal, timeoutMs: number): Promise<T> {
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  const phase = new AbortController();
  const parentAbort = () => phase.abort();
  signal.addEventListener('abort', parentAbort, { once: true });
  let timer: NodeJS.Timeout | undefined;
  return await Promise.race([
    work(phase.signal),
    new Promise<never>((_resolve, reject) => {
      phase.signal.addEventListener('abort', () => reject(signal.aborted ? new DOMException('Cancelled', 'AbortError') : new Error('Repair phase exceeded its bounded timeout.')), { once: true });
      timer = setTimeout(() => phase.abort(), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', parentAbort);
    phase.abort();
  });
}

export async function runFiniteRepairLoop(options: {
  step: SourceStep;
  attempts: number;
  initialOutput: string;
  workspaceRoot: string;
  signal: AbortSignal;
  invokeOpenCode(prompt: string, attempt: number, signal: AbortSignal): Promise<void>;
  rerunExactStep(step: Readonly<SourceStep>, signal: AbortSignal): Promise<ProcessResult>;
}): Promise<ProcessResult> {
  let output = options.initialOutput;
  const attempts = Math.min(options.attempts, SOURCE_RUNTIME_LIMITS.maxRepairAttempts);
  let before = await snapshotWorkspace(options.workspaceRoot);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await withAbortAndTimeout((phaseSignal) => options.invokeOpenCode(createRepairPrompt(options.step, output, attempt), attempt, phaseSignal), options.signal, SOURCE_RUNTIME_LIMITS.maxStepMs);
    const after = await snapshotWorkspace(options.workspaceRoot);
    const changed = new Set([...before.keys(), ...after.keys()].filter((file) => before.get(file)?.hash !== after.get(file)?.hash));
    const changedBytes = [...changed].reduce((total, file) => total + (after.get(file)?.bytes ?? before.get(file)?.bytes ?? 0), 0);
    if (changed.size > SOURCE_RUNTIME_LIMITS.maxFilesChangedPerRepair) throw new Error('OpenCode changed too many files; repair was stopped.');
    if (changedBytes > SOURCE_RUNTIME_LIMITS.maxRepairDiffBytes) throw new Error('OpenCode repair diff exceeded the safety limit.');
    const rerun = await withAbortAndTimeout((phaseSignal) => options.rerunExactStep(Object.freeze({ ...options.step }), phaseSignal), options.signal, options.step.timeoutMs);
    if (rerun.code === 0) return rerun;
    output = rerun.output;
    before = after;
  }
  return { code: -1, output, timedOut: false, cancelled: false };
}

export async function cleanupOwnedWorkspace(root: string, workspace: string, expectedMarker: string): Promise<void> {
  const target = await verifyOwnedDirectChild(root, workspace);
  const marker = await readFile(path.join(target, '.ding-ding-source-job'), 'utf8');
  if (marker !== expectedMarker) throw new Error('Source job cleanup ownership marker did not match.');
  await validateWorkspaceTree(target);
  const rechecked = await verifyOwnedDirectChild(root, workspace);
  if (!samePath(rechecked, target)) throw new Error('Source job directory changed identity before cleanup.');
  await rm(rechecked, { recursive: true, force: true });
}

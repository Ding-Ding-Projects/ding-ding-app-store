import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { extractZipSafe } from '../dist/main/safe-zip.js';
import { createGuestLifecyclePlanDigest, WindowsSandboxGuestTransport, WindowsSandboxProtocolPeer } from '../dist/main/source-runtime.js';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const setup = args.get('--setup'); const nupkg = args.get('--nupkg'); const output = args.get('--output'); const advertiseAddress = args.get('--advertise-address'); const lowlevelClient = args.get('--lowlevel-client'); const runRootArg = args.get('--run-root'); const sandboxExecutableArg = args.get('--sandbox-executable');
if (!setup || !nupkg || !output) throw new Error('Usage: node scripts/prove-guest-lifecycle.mjs --setup <Setup.exe> --nupkg <package.nupkg> --output <receipt.json> --advertise-address <non-loopback IPv4>');

const boundedFile = async (file) => {
  const info = await stat(file);
  if (!info.isFile() || info.size <= 0 || info.size > 500 * 1024 * 1024) throw new Error(`Artifact is missing or outside the bounded size: ${file}`);
  return readFile(file);
};
const findFiles = async (root) => {
  const result = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(full); else result.push(full);
    }
  };
  await visit(root); return result;
};
const validateAdvertiseAddress = (value) => {
  if (typeof value !== 'string' || !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(value.trim())) throw new Error(`Advertise address must be an explicit IPv4 literal; received ${value ?? '<missing>'}.`);
  const octets = value.split('.').map(Number);
  if (octets.some((part) => part < 0 || part > 255) || octets[0] === 0 || octets[0] === 127 || (octets[0] === 169 && octets[1] === 254) || octets[0] >= 224) throw new Error(`Advertise address must be a non-loopback unicast IPv4; received ${value}.`);
  return value;
};
const availableIpv4Candidates = () => {
  const interfaces = os.networkInterfaces();
  const candidates = [];
  for (const entries of Object.values(interfaces)) for (const entry of entries ?? []) {
    if (entry.family === 'IPv4') candidates.push(`${entry.address}${entry.internal ? ' (internal)' : ''}`);
  }
  return candidates;
};
if (!advertiseAddress) throw new Error(`An explicit --advertise-address is required; candidates: ${availableIpv4Candidates().join(', ') || 'none'}`);
if (!lowlevelClient || !path.isAbsolute(lowlevelClient)) throw new Error('An absolute --lowlevel-client path is required; visible desktop or default process spawning is not permitted.');
if (!runRootArg || !path.isAbsolute(runRootArg)) throw new Error('An absolute --run-root temp child path is required for task-owned Lowlevel state.');
if (!sandboxExecutableArg || !path.isAbsolute(sandboxExecutableArg)) throw new Error('An absolute --sandbox-executable path is required.');
const lowlevelClientPath = path.resolve(lowlevelClient); const runRoot = path.resolve(runRootArg); const tempRoot = path.resolve(os.tmpdir());
const sandboxExecutable = path.resolve(sandboxExecutableArg);
if (!runRoot.startsWith(`${tempRoot}${path.sep}`)) throw new Error(`--run-root must be a child of the host temp directory: ${tempRoot}`);
if (!(await stat(lowlevelClientPath).catch(() => null))) throw new Error(`Lowlevel client was not found: ${lowlevelClientPath}`);
const sandboxInfo = await lstat(sandboxExecutable).catch(() => null);
if (!sandboxInfo?.isFile() || path.basename(sandboxExecutable) !== 'WindowsSandboxRemoteSession.exe' || !/\\WindowsApps\\MicrosoftWindows\.WindowsSandbox_[^\\]+\\WindowsSandboxRemoteSession\.exe$/i.test(sandboxExecutable)) throw new Error(`Sandbox executable must be the regular WindowsApps MicrosoftWindows.WindowsSandbox WindowsSandboxRemoteSession.exe: ${sandboxExecutable}`);
await mkdir(runRoot, { recursive: true });

const setupPath = path.resolve(setup); const nupkgPath = path.resolve(nupkg); const outputPath = path.resolve(output);
const setupBytes = await boundedFile(setupPath); const packageBytes = await boundedFile(nupkgPath);
if (setupBytes.subarray(0, 2).toString('ascii') !== 'MZ') throw new Error('Setup.exe is not a PE executable.');
const setupSha256 = createHash('sha256').update(setupBytes).digest('hex');
const packageSha256 = createHash('sha256').update(packageBytes).digest('hex');
const extractionRoot = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-guest-artifact-'));
let peer; let transport; let receipt; const lowlevelState = path.join(runRoot, 'state.json'); const lowlevelLedger = path.join(runRoot, 'launch-ledger.json'); const lowlevelOutputRoot = path.join(runRoot, 'output');
const runLowlevel = (command, input, timeoutMs = 60_000) => new Promise((resolve, reject) => {
  const childArgs = command === 'call' ? ['-3', lowlevelClientPath, 'call', input.tool] : ['-3', lowlevelClientPath, command, '--state', lowlevelState, ...(command === 'cleanup' ? ['--allow-saved-pid-kill'] : [])];
  const child = spawn('py', childArgs, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = ''; let settled = false;
  const timer = setTimeout(() => { if (!settled) { settled = true; child.kill(); reject(new Error(`Lowlevel ${command} exceeded ${timeoutMs}ms: ${stderr || stdout}`)); } }, timeoutMs);
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); }); child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.once('error', (error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } });
  child.once('exit', (code) => { if (settled) return; settled = true; clearTimeout(timer); if (code !== 0) reject(new Error(`Lowlevel ${command} exited ${code}: ${stderr || stdout}`)); else { try { resolve(JSON.parse(stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? '{}')); } catch (error) { reject(new Error(`Lowlevel ${command} returned non-JSON output: ${error instanceof Error ? error.message : String(error)}`)); } } });
  child.stdin.end(input === undefined ? undefined : `${JSON.stringify(command === 'call' ? input.params : input)}\n`);
});
const runLowlevelCall = (tool, params, timeoutMs = 60_000) => runLowlevel('call', { tool, params }, timeoutMs);
try {
  await extractZipSafe(nupkgPath, extractionRoot, undefined, { maxBytes: 500 * 1024 * 1024 });
  const files = await findFiles(extractionRoot);
  const nuspec = files.find((file) => file.toLowerCase().endsWith('.nuspec'));
  const nuspecText = nuspec ? await readFile(nuspec, 'utf8') : '';
  const packageId = /<id>\s*([^<]+)\s*<\/id>/i.exec(nuspecText)?.[1]?.trim() ?? path.basename(nupkgPath, '.nupkg');
  const version = /<version>\s*([^<]+)\s*<\/version>/i.exec(nuspecText)?.[1]?.trim() ?? 'unknown';
  const executable = files.find((file) => /\.exe$/i.test(file) && !/\\(?:Setup|Update|Squirrel)\.exe$/i.test(file));
  if (!executable) throw new Error('The nupkg did not contain a reviewed application executable.');
  const executableBytes = await readFile(executable); const executableFileName = path.basename(executable); const hostIpv4 = validateAdvertiseAddress(advertiseAddress); const jobId = randomUUID(); const challengeNonce = randomBytes(32).toString('hex');
  const unsignedPlan = {
    schemaVersion: 1, protocolVersion: 1, jobId, challengeNonce, guestId: `guest-${jobId}`, planDigest: '', appId: 'ding-ding-app-store', expectedPackage: packageId,
    expectedVersion: version, registryDisplayName: 'Ding Ding App Store', squirrelPackageName: packageId, executableFileName, executableSha256: createHash('sha256').update(executableBytes).digest('hex'), installIdentity: packageId,
    executableRelativeName: executableFileName, expectedWindowTitle: 'Ding Ding App Store', expectedWindowClass: 'Chrome_WidgetWin_1', readinessTimeoutMs: 120_000, stabilityTimeoutMs: 1_000,
    installer: { format: 'squirrel', bytes: setupBytes.length, sha256: setupSha256 }, operations: ['squirrel-install', 'squirrel-launch', 'squirrel-uninstall'], maxStageMs: 120_000,
  };
  const plan = Object.freeze({ ...unsignedPlan, planDigest: createGuestLifecyclePlanDigest(unsignedPlan) });
  peer = new WindowsSandboxProtocolPeer({ advertiseAddress: hostIpv4, listenHost: '0.0.0.0' });
  let recordedPid;
  const launch = async (executable, configPath) => {
    if (path.resolve(executable).toLowerCase() !== sandboxExecutable.toLowerCase()) throw new Error(`Lowlevel launch executable mismatch: ${executable}`);
    const desktop = `GuestLifecycle-${jobId.slice(0, 12)}`;
    const preProcesses = await runLowlevelCall('list_processes', { name_filter: 'WindowsSandboxRemoteSession.exe', limit: 1000 }, 30_000).catch(() => ({ processes: [] }));
    const prePids = (preProcesses.processes ?? []).map((entry) => entry.pid).filter((pid) => Number.isInteger(pid));
    await writeFile(lowlevelLedger, `${JSON.stringify({ schemaVersion: 1, desktop, configPath, runRoot, sandboxExecutable, startedAt: new Date().toISOString(), statePath: lowlevelState, prePids }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    let launchResult;
    try { launchResult = await runLowlevel('launch', { desktop, executable: sandboxExecutable, arguments: [configPath], allowShellWrapper: false, runRoot, outputRoot: lowlevelOutputRoot, cdp: null }, 60_000); }
    catch (error) {
      const listed = await runLowlevelCall('list_headless_windows', { name: desktop }, 30_000).catch(() => ({ windows: [] }));
      const windows = Array.isArray(listed.windows) ? listed.windows : [];
      const postProcesses = await runLowlevelCall('list_processes', { name_filter: 'WindowsSandboxRemoteSession.exe', limit: 1000 }, 30_000).catch(() => ({ processes: [] }));
      const newPids = (postProcesses.processes ?? []).filter((entry) => entry.name === 'WindowsSandboxRemoteSession.exe' && Number.isInteger(entry.pid) && !prePids.includes(entry.pid)).map((entry) => entry.pid);
      const soleWindow = windows.filter((window) => Number(window.width) > 0 && Number(window.height) > 0 && window.title === 'Windows Sandbox' && window.class === 'WinUIDesktopWin32WindowClass');
      if (newPids.length === 1 && (soleWindow.length === 0 || soleWindow.length === 1)) { const pid = newPids[0]; const killed = await runLowlevelCall('kill_process', { pid, force: true }, 30_000).catch(() => ({ ok: false, client_ok: false })); const after = await runLowlevelCall('list_processes', { name_filter: 'WindowsSandboxRemoteSession.exe', limit: 1000 }, 30_000).catch(() => ({ processes: [] })); const closed = await runLowlevelCall('close_headless_desktop', { name: desktop }, 30_000).catch(() => ({ ok: false, client_ok: false })); if (killed.ok === true && killed.client_ok === true && !(after.processes ?? []).some((process) => process.pid === pid) && closed.ok === true && closed.client_ok === true) { await rm(configPath, { force: false }); await rm(lowlevelLedger, { force: false }); } else throw new Error('launch-cleanup-unproven: exact process absence or desktop closure was not proven.'); }
      else if (newPids.length > 1) throw new Error(`launch-cleanup-unproven: multiple new Sandbox processes appeared on ${desktop}.`);
      else throw new Error(`launch-cleanup-unproven: launch failed before state and no exact Sandbox process proof was available (${error instanceof Error ? error.message : String(error)}).`);
      throw error;
    }
    if (launchResult.client_ok !== true || launchResult.ok !== true || !Number.isInteger(launchResult.pid)) throw new Error(`Direct Lowlevel Sandbox launch was not verified: ${JSON.stringify(launchResult)}`);
    recordedPid = launchResult.pid;
    await writeFile(lowlevelLedger, `${JSON.stringify({ schemaVersion: 1, desktop, configPath, runRoot, sandboxExecutable, startedAt: new Date().toISOString(), statePath: lowlevelState, pid: recordedPid }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    return { stop: async () => {
      const cleanupResult = await runLowlevel('cleanup', undefined, 60_000).catch((error) => ({ ok: false, client_ok: false, error: error instanceof Error ? error.message : String(error) }));
      const processTreeStopped = cleanupResult.client_ok === true && cleanupResult.ok === true && cleanupResult.actions?.every((action) => action.ok === true);
      return { processTreeStopped, rootPid: recordedPid };
    } };
  };
  transport = new WindowsSandboxGuestTransport({ platform: 'win32', sandboxExecutable, appDataRoot: runRoot, advertiseAddress: hostIpv4, protocol: peer, launch });
  const startedAt = new Date().toISOString();
  try {
    const result = await transport.executeLifecycle(plan, setupBytes, new AbortController().signal);
    receipt = { schemaVersion: 'ding-ding-app-store.guest-lifecycle-attempt.v2', setup: { path: path.basename(setupPath), bytes: setupBytes.length, sha256: setupSha256 }, nupkg: { path: path.basename(nupkgPath), bytes: packageBytes.length, sha256: packageSha256, packageId, version, executableFileName, executableSha256: plan.executableSha256 }, advertiseAddress: hostIpv4, startedAt, completedAt: new Date().toISOString(), guestFinal: result.guest, sourceDisposalReceipt: result.disposal, verdict: true, status: 'verified' };
  } catch (error) {
    receipt = { schemaVersion: 'ding-ding-app-store.guest-lifecycle-attempt.v2', setup: { path: path.basename(setupPath), bytes: setupBytes.length, sha256: setupSha256 }, nupkg: { path: path.basename(nupkgPath), bytes: packageBytes.length, sha256: packageSha256, packageId, version, executableFileName, executableSha256: plan.executableSha256 }, advertiseAddress: hostIpv4, startedAt, completedAt: new Date().toISOString(), verdict: false, status: 'blocked', reason: error instanceof Error ? error.message : String(error) };
    process.exitCode = 1;
  }
} finally {
  const ledger = await readFile(lowlevelLedger, 'utf8').then((value) => JSON.parse(value)).catch(() => null);
  let lowlevelCleanup;
  if (await stat(lowlevelState).catch(() => null)) {
    try { lowlevelCleanup = await runLowlevel('cleanup', undefined, 60_000); } catch (error) { lowlevelCleanup = { ok: false, client_ok: false, error: error instanceof Error ? error.message : String(error) }; }
  }
  const cleanupVerified = lowlevelCleanup?.ok === true && lowlevelCleanup?.client_ok === true && lowlevelCleanup.actions?.every((action) => action.ok === true);
  if (cleanupVerified) {
    if (ledger?.configPath) await rm(ledger.configPath, { force: false }).catch(() => undefined);
    for (const config of await readdir(runRoot).then((names) => names.filter((name) => name.toLowerCase().endsWith('.wsb'))).catch(() => [])) await rm(path.join(runRoot, config), { force: false });
  }
  if (receipt && typeof receipt === 'object') receipt.cleanup = { lowlevelCleanup: lowlevelCleanup ?? null, cleanupVerified, runRoot, statePath: lowlevelState, ledgerPath: lowlevelLedger, remainingConfigFiles: (await readdir(runRoot).catch(() => [])).filter((name) => name.toLowerCase().endsWith('.wsb')).map((name) => path.join(runRoot, name)) };
  await transport?.abort?.(receipt?.guestFinal?.jobId ?? '').catch(() => undefined);
  await peer?.close?.().catch(() => undefined);
  await rm(extractionRoot, { recursive: true, force: true });
}
await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
process.stderr.write(`[prove-guest-lifecycle] live Sandbox attempt status=${receipt.status}; verdict=${receipt.verdict}; receipt=${outputPath}\n`);

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { extractZipSafe } from '../dist/main/safe-zip.js';
import { createGuestLifecyclePlanDigest, WindowsSandboxGuestTransport, WindowsSandboxProtocolPeer } from '../dist/main/source-runtime.js';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const setup = args.get('--setup'); const nupkg = args.get('--nupkg'); const output = args.get('--output'); const advertiseAddress = args.get('--advertise-address');
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

const setupPath = path.resolve(setup); const nupkgPath = path.resolve(nupkg); const outputPath = path.resolve(output);
const setupBytes = await boundedFile(setupPath); const packageBytes = await boundedFile(nupkgPath);
if (setupBytes.subarray(0, 2).toString('ascii') !== 'MZ') throw new Error('Setup.exe is not a PE executable.');
const setupSha256 = createHash('sha256').update(setupBytes).digest('hex');
const packageSha256 = createHash('sha256').update(packageBytes).digest('hex');
const extractionRoot = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-guest-artifact-'));
let peer; let transport; let receipt;
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
  transport = new WindowsSandboxGuestTransport({ platform: process.platform, advertiseAddress: hostIpv4, protocol: peer });
  const startedAt = new Date().toISOString();
  try {
    const result = await transport.executeLifecycle(plan, setupBytes, new AbortController().signal);
    receipt = { schemaVersion: 'ding-ding-app-store.guest-lifecycle-attempt.v2', setup: { path: path.basename(setupPath), bytes: setupBytes.length, sha256: setupSha256 }, nupkg: { path: path.basename(nupkgPath), bytes: packageBytes.length, sha256: packageSha256, packageId, version, executableFileName, executableSha256: plan.executableSha256 }, advertiseAddress: hostIpv4, startedAt, completedAt: new Date().toISOString(), guestFinal: result.guest, sourceDisposalReceipt: result.disposal, verdict: true, status: 'verified' };
  } catch (error) {
    receipt = { schemaVersion: 'ding-ding-app-store.guest-lifecycle-attempt.v2', setup: { path: path.basename(setupPath), bytes: setupBytes.length, sha256: setupSha256 }, nupkg: { path: path.basename(nupkgPath), bytes: packageBytes.length, sha256: packageSha256, packageId, version, executableFileName, executableSha256: plan.executableSha256 }, advertiseAddress: hostIpv4, startedAt, completedAt: new Date().toISOString(), verdict: false, status: 'blocked', reason: error instanceof Error ? error.message : String(error) };
    process.exitCode = 1;
  }
} finally {
  await transport?.abort?.(receipt?.guestFinal?.jobId ?? '').catch(() => undefined);
  await peer?.close?.().catch(() => undefined);
  await rm(extractionRoot, { recursive: true, force: true });
}
await writeFile(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
process.stderr.write(`[prove-guest-lifecycle] live Sandbox attempt status=${receipt.status}; verdict=${receipt.verdict}; receipt=${outputPath}\n`);

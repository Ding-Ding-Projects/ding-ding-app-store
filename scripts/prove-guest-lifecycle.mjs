import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const setup = args.get('--setup'); const nupkg = args.get('--nupkg'); const output = args.get('--output');
if (!setup || !nupkg || !output) throw new Error('Usage: node scripts/prove-guest-lifecycle.mjs --setup <Setup.exe> --nupkg <package.nupkg> --output <receipt.json>');
const boundedFile = async (file) => { const info = await stat(file); if (!info.isFile() || info.size <= 0 || info.size > 500 * 1024 * 1024) throw new Error(`Artifact is missing or outside the bounded size: ${file}`); return readFile(file); };
const setupBytes = await boundedFile(path.resolve(setup)); const packageBytes = await boundedFile(path.resolve(nupkg));
const setupSha256 = createHash('sha256').update(setupBytes).digest('hex'); const packageSha256 = createHash('sha256').update(packageBytes).digest('hex');
const receipt = { schemaVersion: 'ding-ding-app-store.guest-lifecycle-attempt.v1', setup: { path: path.basename(setup), bytes: setupBytes.length, sha256: setupSha256 }, nupkg: { path: path.basename(nupkg), bytes: packageBytes.length, sha256: packageSha256 }, verdict: false, status: 'blocked', reason: 'live-driver-not-configured', attemptedAt: new Date().toISOString() };
await writeFile(path.resolve(output), `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
process.stderr.write('[prove-guest-lifecycle] live Windows Sandbox driver was not configured; no host install was attempted.\n');
process.exitCode = 1;

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, realpath, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { SourceJobDecision, SourceJobState, SourceTerminalEvent, SourceTerminalStream } from '../shared/contracts.js';

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

export const sourceStepSchema = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,47}$/),
  label: z.string().trim().min(1).max(120),
  executable: z.enum(['node.exe', 'py.exe', 'python.exe', 'cargo.exe', 'cmake.exe', 'ninja.exe', 'dotnet.exe']),
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

export const sourceRecipeSchema = z.strictObject({
  schemaVersion: z.literal(1),
  appId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  repository: z.string().regex(/^Ding-Ding-Projects\/[A-Za-z0-9_.-]+$/),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  sourceArchiveSha256: z.string().regex(/^[a-f0-9]{64}$/),
  dependencies: z.array(dependencyBootstrapSchema).max(32),
  prepare: z.array(sourceStepSchema).max(16),
  validate: z.array(sourceStepSchema).min(1).max(16),
  build: z.array(sourceStepSchema).min(1).max(24),
  test: z.array(sourceStepSchema).max(24),
  run: z.array(sourceStepSchema).max(8),
  repairableStepIds: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,47}$/)).max(32),
  finalOutputs: z.array(relativePathSchema).min(1).max(32),
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
  });
});

export type SourceStep = z.infer<typeof sourceStepSchema>;
export type SourceRecipe = z.infer<typeof sourceRecipeSchema>;
export type SourceRecipeCatalog = z.infer<typeof sourceRecipeCatalogSchema>;

export interface IsolationAttestation {
  kind: 'hard-disposable';
  network: 'recipe-and-opencode-only';
  hostMounts: 0;
  userProfileMounted: false;
  credentialsInjected: false;
  secretsInjected: false;
  shellStringsAllowed: false;
  cleanupOnExit: true;
}

export const REQUIRED_ISOLATION: Readonly<IsolationAttestation> = Object.freeze({
  kind: 'hard-disposable',
  network: 'recipe-and-opencode-only',
  hostMounts: 0,
  userProfileMounted: false,
  credentialsInjected: false,
  secretsInjected: false,
  shellStringsAllowed: false,
  cleanupOnExit: true,
});

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
  repairableStepIds: string[];
  finalOutputs: string[];
  repairAttempts: number;
  openCode: typeof PINNED_OPENCODE;
  openCodeConfig: ReturnType<typeof createOpenCodeConfig>;
  openCodeArguments: readonly ['run', '--auto'];
  forbiddenRepairEntries: readonly string[];
}

export interface IsolationBroker {
  attest(): Promise<IsolationAttestation | null>;
  execute(plan: Readonly<SourceExecutionPlan>, emit: (event: RuntimeLine) => void, signal: AbortSignal): Promise<void>;
  dispose(jobId: string): Promise<void>;
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

export class UnavailableIsolationBroker implements IsolationBroker {
  async attest(): Promise<null> { return null; }
  async execute(): Promise<void> { throw new Error('A reviewed hard-disposable source runner is not available. Source code was not executed on the host.'); }
  async dispose(): Promise<void> { /* No guest exists. */ }
}

export function isolationMatches(attestation: IsolationAttestation | null): attestation is IsolationAttestation {
  return Boolean(attestation && Object.entries(REQUIRED_ISOLATION).every(([key, value]) => attestation[key as keyof IsolationAttestation] === value));
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
  return {
    jobId,
    appId: recipe.appId,
    decision,
    workspaceName: `source-job-${jobId}`,
    sourceArchiveUrl: `https://github.com/${recipe.repository}/archive/${recipe.revision}.zip`,
    sourceArchiveSha256: recipe.sourceArchiveSha256,
    revision: recipe.revision,
    dependencies: recipe.dependencies,
    steps: selected,
    repairableStepIds: recipe.repairableStepIds,
    finalOutputs: recipe.finalOutputs,
    repairAttempts: recipe.repairAttempts,
    openCode: PINNED_OPENCODE,
    openCodeConfig: createOpenCodeConfig(),
    openCodeArguments: ['run', '--auto'],
    forbiddenRepairEntries: ['.git', '.opencode', 'opencode.json', 'opencode.jsonc', 'AGENTS.md', 'CLAUDE.md'],
  };
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

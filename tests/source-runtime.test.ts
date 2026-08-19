import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { sourceJobCancelRequestSchema, sourceJobRequestSchema, sourceJobRetryRequestSchema, sourceTerminalEventSchema } from '../src/shared/contracts.js';
import { SourceJobService } from '../src/main/source-job-service.js';
import {
  PINNED_OPENCODE,
  WindowsSandboxIsolationBroker,
  WindowsSandboxGuestTransport,
  REQUIRED_ISOLATION,
  SOURCE_RUNTIME_LIMITS,
  TerminalEventBudget,
  cleanupOwnedWorkspace,
  createOpenCodeConfig,
  createRepairPrompt,
  createSourceExecutionPlan,
  createGuestBootstrap,
  createZeroMountSandboxConfig,
  validateGuestBootstrap,
  SOURCE_GUEST_POLICY,
  SOURCE_GUEST_IDENTITY,
  isolationMatches,
  createIsolationAttestationChallenge,
  validateCapabilityLease,
  validateIsolationAttestation,
  rejectSymlinkEscape,
  resolveOwnedPath,
  runFiniteRepairLoop,
  sanitizeTerminalText,
  sourceRecipeCatalogSchema,
  validateOpenCodeArchive,
  validateOpenCodeExecutable,
  ensurePinnedOpenCode,
  probeWindowsDisposableGuest,
  verifyOwnedRoot,
  type IsolationAttestation,
  type IsolationAttestationChallenge,
  type IsolationBroker,
  type RuntimeLine,
  type SourceExecutionPlan,
  type SourceRecipe,
} from '../src/main/source-runtime.js';
import type { SourceTerminalEvent } from '../src/shared/contracts.js';
import type { CatalogService } from '../src/main/catalog-service.js';
import type { HistoryService } from '../src/main/history-service.js';
import type { SettingsService } from '../src/main/settings-service.js';

const temporary: string[] = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((entry) => rm(entry, { recursive: true, force: true }))); });

async function tempRoot(name: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), `${name}-`));
  temporary.push(root);
  return root;
}

const step = {
  id: 'build-app', label: 'Build app', executable: 'node.exe', arguments: ['tools/npm-cli.js', 'run', 'build'], cwd: 'source', timeoutMs: 30_000, expectedOutputs: ['dist/app.exe'],
} as const;

const recipe: SourceRecipe = {
  schemaVersion: 1,
  appId: 'reviewed-app',
  repository: 'Ding-Ding-Projects/reviewed-app',
  revision: '1'.repeat(40),
  sourceArchiveSha256: '2'.repeat(64),
  dependencies: [], prepare: [], validate: [{ ...step, id: 'validate-app', arguments: ['run', 'check'] }], build: [{ ...step }], test: [], run: [{ ...step, id: 'run-app', arguments: ['run', 'start'] }],
  repairableStepIds: ['build-app', 'run-app'], finalOutputs: ['dist/app.exe'], repairAttempts: 2,
};

describe('source job contracts', () => {
  const brokerIdentity = { brokerId: 'test-broker', transportId: 'test-transport' } as const;

  it('binds guest attestation and capability lease to a fresh nonce, identity, and expiry', () => {
    const now = Date.parse('2026-08-12T12:00:00.000Z');
    const jobId = crypto.randomUUID();
    const challenge = createIsolationAttestationChallenge(jobId, 60_000, brokerIdentity, now);
    const lease = {
      leaseId: crypto.randomUUID(), jobId, challengeNonce: challenge.nonce, brokerId: brokerIdentity.brokerId, transportId: brokerIdentity.transportId,
        issuedAt: new Date(now).toISOString(), expiresAt: challenge.leaseExpiresAt, capabilities: ['execute', 'dispose'] as const,
    };
    const attestation = { ...REQUIRED_ISOLATION, version: 1 as const, jobId, challengeNonce: challenge.nonce, brokerId: brokerIdentity.brokerId, transportId: brokerIdentity.transportId, attestedAt: new Date(now).toISOString(), expiresAt: challenge.expiresAt, lease };
    expect(validateIsolationAttestation(attestation, challenge, now)).toMatchObject({ ok: true });
    expect(validateCapabilityLease(lease, challenge, 'execute', now)).toBe(true);
    expect(validateCapabilityLease({ ...lease, challengeNonce: '0'.repeat(64) }, challenge, 'execute', now)).toBe(false);
    expect(validateIsolationAttestation({ ...attestation, transportId: 'other-transport' }, challenge, now)).toMatchObject({ ok: false, reason: 'guest-attestation-identity-mismatch' });
    expect(validateIsolationAttestation(attestation, challenge, now + 31_000)).toMatchObject({ ok: false, reason: 'guest-attestation-expired' });
  });

  it('rejects malformed challenge identities and unbounded leases', () => {
    expect(() => createIsolationAttestationChallenge(crypto.randomUUID(), 0, brokerIdentity)).toThrow(/duration/i);
    expect(() => createIsolationAttestationChallenge(crypto.randomUUID(), 60_000, null)).toThrow(/identity/i);
    const challenge = createIsolationAttestationChallenge(crypto.randomUUID(), 60_000, { brokerId: 'test-broker', transportId: 'test-transport' }, Date.parse('2026-08-12T12:00:00.000Z'));
    const lease = { leaseId: crypto.randomUUID(), jobId: challenge.jobId, challengeNonce: challenge.nonce, brokerId: challenge.expectedBrokerId, transportId: challenge.expectedTransportId, issuedAt: '2026-08-12T12:00:00.000Z', expiresAt: '2026-08-12T12:01:00.000Z', capabilities: ['execute', 'dispose'] as const };
    expect(validateCapabilityLease({ ...lease, issuedAt: '2026-08-12T12:00:00.000Zx' }, challenge, 'execute', Date.parse('2026-08-12T12:00:01.000Z'))).toBe(false);
    expect(validateCapabilityLease({ ...lease, executeExpiresAt: '2026-08-12T12:00:00.000Zx' }, challenge, 'execute', Date.parse('2026-08-12T12:00:01.000Z'))).toBe(false);
    expect(validateCapabilityLease({ ...lease, disposeExpiresAt: '2026-08-12T12:00:00.000Zx' }, challenge, 'dispose', Date.parse('2026-08-12T12:00:01.000Z'))).toBe(false);
    expect(validateCapabilityLease(lease, challenge, 'execute', Date.parse(lease.expiresAt))).toBe(false);
    expect(validateCapabilityLease(lease, challenge, 'dispose', Date.parse(lease.expiresAt) + 1_000)).toBe(false);
  });

  it('accepts only an app ID plus a typed build/run decision', () => {
    expect(sourceJobRequestSchema.safeParse({ appId: 'reviewed-app', decision: 'build' }).success).toBe(true);
    for (const invalid of [
      { appId: 'reviewed-app', decision: 'install' },
      { appId: '../escape', decision: 'run' },
      { appId: 'reviewed-app', decision: 'build', command: 'npm run build' },
      { appId: 'reviewed-app', decision: 'run', cwd: 'C:\\Users' },
    ]) expect(sourceJobRequestSchema.safeParse(invalid).success).toBe(false);
    expect(sourceJobCancelRequestSchema.safeParse({ jobId: crypto.randomUUID(), decision: 'cancel', force: true }).success).toBe(false);
    expect(sourceJobRetryRequestSchema.safeParse({ jobId: crypto.randomUUID(), decision: 'retry' }).success).toBe(true);
    expect(sourceJobRetryRequestSchema.safeParse({ jobId: crypto.randomUUID(), decision: 'retry', force: true }).success).toBe(false);
  });

  it('keeps recipes pinned, vector-only, bounded, and free of Git execution', () => {
    expect(sourceRecipeCatalogSchema.parse({ schemaVersion: 1, recipes: [recipe] }).recipes).toHaveLength(1);
    expect(sourceRecipeCatalogSchema.safeParse({ schemaVersion: 1, recipes: [{ ...recipe, extra: true }] }).success).toBe(false);
    expect(sourceRecipeCatalogSchema.safeParse({ schemaVersion: 1, recipes: [{ ...recipe, build: [{ ...step, executable: 'git.exe' }] }] }).success).toBe(false);
    expect(sourceRecipeCatalogSchema.safeParse({ schemaVersion: 1, recipes: [{ ...recipe, build: [{ ...step, arguments: ['run build & whoami'] }] }] }).success).toBe(false);
  });

  it('confines blanket approval to an attested plan and never uses unrestricted host config', () => {
    const config = createOpenCodeConfig();
    expect(config).toMatchObject({ permission: 'allow', share: 'disabled', instructions: [], mcp: {}, plugin: [], autoupdate: false, snapshot: false, lsp: false });
    expect(isolationMatches(REQUIRED_ISOLATION)).toBe(true);
    expect(isolationMatches({ ...REQUIRED_ISOLATION, hostMounts: 1 } as IsolationAttestation)).toBe(false);
    const plan = createSourceExecutionPlan(crypto.randomUUID(), 'build', recipe);
    expect(plan.openCodeConfig.permission).toBe('allow');
    expect(plan.sourceArchiveUrl).toContain(`/archive/${recipe.revision}.zip`);
    expect(plan).not.toHaveProperty('repositoryUrl');
    expect(plan.steps.map((entry) => entry.id)).toEqual(['validate-app', 'build-app']);
    expect(plan.openCodeArguments).toEqual(['run', '--auto']);
    expect(plan.forbiddenRepairEntries).toContain('.opencode');
  });

  it('binds the fixed guest bootstrap to the plan digest and emits a zero-mount Sandbox document', () => {
    const jobId = crypto.randomUUID();
    const plan = createSourceExecutionPlan(jobId, 'build', recipe);
    const challenge = createIsolationAttestationChallenge(jobId, 60_000, SOURCE_GUEST_IDENTITY, Date.parse('2026-08-12T12:00:00.000Z'));
    const bootstrap = createGuestBootstrap(plan, challenge.nonce, `guest-${jobId}`);
    expect(validateGuestBootstrap(bootstrap, plan, challenge)).toBe(true);
    expect(validateGuestBootstrap({ ...bootstrap, planDigest: '0'.repeat(64) }, plan, challenge)).toBe(false);
    const wsb = createZeroMountSandboxConfig('powershell.exe -NoProfile -EncodedCommand AAA=');
    expect(wsb).toContain('<MappedFolders></MappedFolders>');
    expect(wsb).toContain('<ClipboardRedirection>Disable</ClipboardRedirection>');
    expect(wsb).toContain('<ProtectedClient>Enable</ProtectedClient>');
    expect(wsb).not.toContain('<MappedFolder>');
    expect(SOURCE_GUEST_POLICY.hostMounts).toBe(0);
  });

  it('reports a configured protocol peer as ready while preserving the real guest policy', async () => {
    const transport = new WindowsSandboxGuestTransport({ platform: 'win32', fileExists: async () => true, endpoint: 'http://127.0.0.1:4567', protocol: {} as never, checkedAt: () => '2026-08-12T12:00:00.000Z' });
    await expect(transport.diagnose()).resolves.toMatchObject({ available: true, reason: 'ready', checkedAt: '2026-08-12T12:00:00.000Z' });
    expect(transport.identity()).toEqual(SOURCE_GUEST_IDENTITY);
  });

  it('reports Windows Sandbox capability without launching a host process', async () => {
    const missing = await probeWindowsDisposableGuest({
      platform: 'win32',
      systemRoot: 'C:\\Windows',
      fileExists: async () => false,
      checkedAt: () => '2026-08-08T00:00:00.000Z',
    });
    expect(missing).toMatchObject({ available: false, provider: 'windows-sandbox', reason: 'sandbox-executable-missing', checkedAt: '2026-08-08T00:00:00.000Z' });

    const present = await probeWindowsDisposableGuest({ platform: 'win32', fileExists: async () => true });
    expect(present).toMatchObject({ available: false, reason: 'guest-transport-not-connected' });
    expect(present.evidence.join(' ')).toMatch(/not connected/i);
    const broker = new WindowsSandboxIsolationBroker(async () => present);
    await expect(broker.execute(createSourceExecutionPlan(crypto.randomUUID(), 'build', recipe), () => undefined, new AbortController().signal)).rejects.toThrow(/guest-transport-not-connected/);
  });
});

describe('terminal bounds and redaction', () => {
  it('strips terminal control sequences, credentials, and host paths before IPC', () => {
    const sanitized = sanitizeTerminalText('\u001b[31mAuthorization: Bearer topsecret\u001b[0m C:\\Users\\Alice\\file ghp_123456789abcdef', '');
    expect(sanitized).not.toContain('\u001b');
    expect(sanitized).not.toContain('topsecret');
    expect(sanitized).not.toContain('Alice');
    expect(sanitized).not.toContain('ghp_');
    expect(sanitized).toContain('[redacted]');
  });

  it('bounds cumulative output and always reserves exactly one valid final event', () => {
    const jobId = crypto.randomUUID();
    const budget = new TerminalEventBudget(jobId, 'reviewed-app', 'C:\\owned');
    let emitted = 0;
    for (let index = 0; index < SOURCE_RUNTIME_LIMITS.maxEvents + 20; index += 1) {
      if (budget.next({ stream: 'stdout', state: 'running', text: 'x\n' })) emitted += 1;
    }
    expect(emitted).toBe(SOURCE_RUNTIME_LIMITS.maxEvents);
    const final = budget.next({ stream: 'system', state: 'failed', text: 'bounded failure' }, true);
    expect(sourceTerminalEventSchema.safeParse(final).success).toBe(true);
    expect(final?.final).toBe(true);
    expect(budget.next({ stream: 'system', state: 'failed', text: 'second final' }, true)).toBeNull();
  });

  it('redacts credentials split across event boundaries before any event is emitted', () => {
    const budget = new TerminalEventBudget(crypto.randomUUID(), 'reviewed-app', 'C:\\owned');
    expect(budget.next({ stream: 'stderr', state: 'running', text: 'Authorization: Bea' })).toBeNull();
    expect(budget.next({ stream: 'stderr', state: 'running', text: 'rer topsecret' })).toBeNull();
    const final = budget.next({ stream: 'system', state: 'failed', text: '\nfailed' }, true);
    expect(final?.text).not.toContain('topsecret');
    expect(final?.text).toContain('[redacted]');
  });

  it('holds split ANSI, URL credentials, and token prefixes until framing can redact them', () => {
    const budget = new TerminalEventBudget(crypto.randomUUID(), 'reviewed-app', 'C:\\owned');
    expect(budget.next({ stream: 'stdout', state: 'running', text: '\u001b]0;title\u001b\\https://user:' })).toBeNull();
    expect(budget.next({ stream: 'stdout', state: 'running', text: 'password@example.test gh' })).toBeNull();
    const event = budget.next({ stream: 'stdout', state: 'running', text: 'p_123456789abcdef\n' });
    expect(event?.text).not.toContain('password');
    expect(event?.text).not.toContain('ghp_');
    expect(event?.text).not.toContain('\u001b');
    expect(event?.text).toContain('[redacted]');
  });
});

describe('owned workspace and repair bounds', () => {
  it('rejects missing or invalid OpenCode artifacts and keeps archive/executable pins distinct', async () => {
    const root = await tempRoot('opencode-invalid');
    const invalid = path.join(root, 'opencode.exe');
    await writeFile(invalid, 'not opencode');
    expect(PINNED_OPENCODE.sha256).not.toBe(PINNED_OPENCODE.executableSha256);
    expect(await validateOpenCodeArchive(invalid)).toBe(false);
    let versionRuns = 0;
    expect(await validateOpenCodeExecutable(invalid, async () => { versionRuns += 1; return PINNED_OPENCODE.version; })).toBe(false);
    expect(versionRuns).toBe(0);
    await expect(validateOpenCodeArchive(path.join(root, 'missing.zip'))).rejects.toThrow();
  });

  it('only bootstraps OpenCode inside an owned child and cleans a failed download', async () => {
    const root = await tempRoot('opencode-bootstrap');
    await mkdir(path.join(root, '.opencode-tool'));
    await expect(ensurePinnedOpenCode({
      workspaceRoot: root,
      toolDirectory: 'nested/tool',
      downloadArchive: async () => { throw new Error('must not download'); },
      runVersion: async () => PINNED_OPENCODE.version,
    })).rejects.toThrow(/bounded workspace child/i);
    await expect(ensurePinnedOpenCode({
      workspaceRoot: root,
      downloadArchive: async (_url, destination) => { await writeFile(destination, 'not a pinned archive'); },
      runVersion: async () => PINNED_OPENCODE.version,
    })).rejects.toThrow(/SHA-256/i);
    await expect(readFile(path.join(root, '.opencode-tool', `${PINNED_OPENCODE.assetName}.download`))).rejects.toThrow();
  });
  it('rejects lexical escape and symlink traversal', async () => {
    const root = await tempRoot('source-owned');
    await mkdir(path.join(root, 'safe'));
    expect(() => resolveOwnedPath(root, '..\\escape')).toThrow(/escaped/);
    const outside = await tempRoot('source-outside');
    const link = path.join(root, 'safe', 'link');
    try {
      await symlink(outside, link, 'junction');
      await expect(rejectSymlinkEscape(root, 'safe/link')).rejects.toThrow(/Symbolic links/);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
    }
  });

  it('requires a matching ownership marker before recursive cleanup', async () => {
    const root = await tempRoot('source-cleanup');
    const workspace = path.join(root, 'job-one');
    await mkdir(workspace);
    await writeFile(path.join(workspace, '.ding-ding-source-job'), 'nonce-one');
    await expect(cleanupOwnedWorkspace(root, 'job-one', 'wrong')).rejects.toThrow(/marker/);
    await cleanupOwnedWorkspace(root, 'job-one', 'nonce-one');
    await expect(readFile(workspace)).rejects.toThrow();
  });

  it('rejects a configured owned root that is a Windows junction', async () => {
    const parent = await tempRoot('source-junction-parent');
    const outside = await tempRoot('source-junction-target');
    const root = path.join(parent, 'source-jobs');
    try {
      await symlink(outside, root, 'junction');
      await expect(verifyOwnedRoot(root)).rejects.toThrow(/junction|symbolic link/i);
      const job = path.join(outside, 'job-one');
      await mkdir(job);
      await writeFile(path.join(job, '.ding-ding-source-job'), 'nonce-one');
      await expect(cleanupOwnedWorkspace(root, 'job-one', 'nonce-one')).rejects.toThrow(/junction|symbolic link/i);
      expect(await readFile(path.join(job, '.ding-ding-source-job'), 'utf8')).toBe('nonce-one');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EPERM') throw error;
    }
  });

  it('limits repairs, validates real changed files, reruns the exact step, and honors cancellation', async () => {
    const root = await tempRoot('source-repair');
    await mkdir(path.join(root, 'source'));
    await writeFile(path.join(root, 'source', 'app.ts'), 'before');
    const controller = new AbortController();
    const rerunIds: string[] = [];
    let attempts = 0;
    const result = await runFiniteRepairLoop({
      step: { ...step }, attempts: 9, initialOutput: 'compile failed', workspaceRoot: root, signal: controller.signal,
      invokeOpenCode: async (_prompt, attempt) => { attempts += 1; await writeFile(path.join(root, 'source', 'app.ts'), `attempt-${attempt}`); },
      rerunExactStep: async (exact) => { rerunIds.push(exact.id); return { code: rerunIds.length === 2 ? 0 : 1, output: 'still failed', timedOut: false, cancelled: false }; },
    });
    expect(result.code).toBe(0);
    expect(attempts).toBe(2);
    expect(rerunIds).toEqual(['build-app', 'build-app']);

    controller.abort();
    await expect(runFiniteRepairLoop({
      step: { ...step }, attempts: 1, initialOutput: 'failed', workspaceRoot: root, signal: controller.signal,
      invokeOpenCode: async () => undefined,
      rerunExactStep: async () => ({ code: 0, output: '', timedOut: false, cancelled: false }),
    })).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('builds a factual bounded prompt without widening the recipe', () => {
    const prompt = createRepairPrompt(step, 'npm failed\nAuthorization: Bearer nope', 1);
    for (const rule of ['Do not force-push', 'switch branches', 'create commits', 'access external paths', 'read secrets', 'replace pinned dependencies']) expect(prompt).toContain(rule);
    expect(prompt).not.toContain('nope');
    expect(prompt).toContain(JSON.stringify([step.executable, ...step.arguments]));
  });
});

class FakeBroker implements IsolationBroker {
  disposed: string[] = [];
  constructor(private readonly behavior: 'wait-for-cancel' | 'hang' | 'complete' = 'wait-for-cancel') {}
  identity() { return { brokerId: 'test-broker', transportId: 'test-transport' }; }
  async attest(challenge: Readonly<IsolationAttestationChallenge>, _signal: AbortSignal): Promise<IsolationAttestation> {
    const now = Date.parse(challenge.issuedAt);
    return {
      ...REQUIRED_ISOLATION,
      version: 1,
      jobId: challenge.jobId,
      challengeNonce: challenge.nonce,
      brokerId: challenge.expectedBrokerId,
      transportId: challenge.expectedTransportId,
      attestedAt: new Date(now).toISOString(),
      expiresAt: challenge.expiresAt,
      lease: {
        leaseId: crypto.randomUUID(), jobId: challenge.jobId, challengeNonce: challenge.nonce, brokerId: challenge.expectedBrokerId, transportId: challenge.expectedTransportId,
        issuedAt: new Date(now).toISOString(), expiresAt: challenge.leaseExpiresAt, capabilities: ['execute', 'dispose'],
      },
    };
  }
  async execute(_plan: Readonly<SourceExecutionPlan>, emit: (line: RuntimeLine) => void, signal: AbortSignal, _lease: Readonly<import('../src/main/source-runtime.js').IsolationCapabilityLease>): Promise<void> {
    emit({ stream: 'progress', state: 'running', text: 'running', progress: 20 });
    if (this.behavior === 'complete') return;
    await new Promise<void>((resolve, reject) => {
      if (this.behavior === 'hang') return;
      if (signal.aborted) reject(new DOMException('Cancelled', 'AbortError'));
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
    });
  }
  async dispose(jobId: string): Promise<void> { this.disposed.push(jobId); }
  async abort(jobId: string): Promise<void> { this.disposed.push(jobId); }
}

async function serviceFixture(behavior: 'wait-for-cancel' | 'hang' | 'complete', timeoutMs = 2_000) {
  const root = await tempRoot('source-service');
  const recipeFile = path.join(root, 'recipes.json');
  await writeFile(recipeFile, JSON.stringify({ schemaVersion: 1, recipes: [recipe] }));
  const events: SourceTerminalEvent[] = [];
  const catalog = { recordFor: async () => ({ id: recipe.appId, displayName: 'Reviewed App', availability: 'source-build', packageType: 'source', repository: 'reviewed-app' }) } as unknown as CatalogService;
  const history = { record: async () => undefined } as unknown as HistoryService;
  const settings = { load: async () => ({ automaticRepairConsent: true }) } as unknown as SettingsService;
  const broker = new FakeBroker(behavior);
  const service = new SourceJobService(catalog, history, settings, path.join(root, 'jobs'), recipeFile, broker, (event) => events.push(event as SourceTerminalEvent), timeoutMs);
  return { service, broker, events };
}

async function waitForFinal(events: SourceTerminalEvent[], timeoutMs = 1_000, jobId?: string): Promise<SourceTerminalEvent> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const final = events.find((event) => event.final && (!jobId || event.jobId === jobId));
    if (final) return final;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for final source event.');
}

describe('source job lifecycle', () => {
  it('rejects duplicate work, cancels the guest, and emits one final cancellation', async () => {
    const { service, broker, events } = await serviceFixture('wait-for-cancel');
    const starts = await Promise.all([
      service.start({ appId: recipe.appId, decision: 'build' }),
      service.start({ appId: recipe.appId, decision: 'build' }),
    ]);
    const first = starts.find((entry) => entry.ok)!;
    expect(first.ok).toBe(true);
    expect(starts.filter((entry) => entry.ok)).toHaveLength(1);
    expect((await service.cancel({ jobId: first.jobId, decision: 'cancel' })).state).toBe('cancelled');
    const final = await waitForFinal(events);
    expect(final.state).toBe('cancelled');
    expect(events.filter((event) => event.final)).toHaveLength(1);
    expect(broker.disposed).toContain(first.jobId);
  });

  it('terminates a hanging disposable guest at the global timeout', async () => {
    const { service, broker, events } = await serviceFixture('hang', 25);
    const started = await service.start({ appId: recipe.appId, decision: 'build' });
    const final = await waitForFinal(events);
    expect(started.ok).toBe(true);
    expect(final.state).toBe('failed');
    expect(final.text).toMatch(/safety limit/i);
    expect(broker.disposed).toContain(started.jobId);
  });

  it('retries a failed job through the same typed recipe without accepting renderer commands', async () => {
    const { service, events } = await serviceFixture('hang', 25);
    const started = await service.start({ appId: recipe.appId, decision: 'build' });
    const firstFinal = await waitForFinal(events);
    expect(firstFinal.state).toBe('failed');
    const retried = await service.retry({ jobId: started.jobId!, decision: 'retry' });
    expect(retried.ok).toBe(true);
    expect(retried.jobId).not.toBe(started.jobId);
    await waitForFinal(events, 1_000, retried.jobId);
    expect(await service.retry({ jobId: retried.jobId!, decision: 'retry', command: 'format C:' } as unknown)).toMatchObject({ ok: false, state: 'failed' });
  });

  it('requires persisted consent and never repairs ordinary release installation', async () => {
    const fixture = await serviceFixture('complete');
    const deniedSettings = { load: async () => ({ automaticRepairConsent: false }) } as unknown as SettingsService;
    const denied = new SourceJobService(
      (fixture.service as unknown as { catalog: CatalogService }).catalog,
      {} as HistoryService,
      deniedSettings,
      'unused',
      'unused',
    );
    expect((await denied.start({ appId: recipe.appId, decision: 'build' })).message).toMatch(/consent/i);
    const operations = await readFile(new URL('../src/main/operation-service.ts', import.meta.url), 'utf8');
    expect(operations).not.toMatch(/SourceJobService|source-runtime|OpenCode|permission:\s*['"]allow/);
    expect(operations).toContain('async install(request: unknown)');
  });
});

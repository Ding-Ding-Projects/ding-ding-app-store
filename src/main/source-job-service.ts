import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ZipFile } from 'yazl';
import type { SourceDisposalReceipt, SourceJobCancelRequest, SourceJobRequest, SourceJobRetryRequest, SourceJobStartResult, SourceOutputExportRequest, SourceOutputExportResult, SourceOutputManifest, SourceTerminalEvent } from '../shared/contracts.js';
import { sourceJobCancelRequestSchema, sourceJobRequestSchema, sourceJobRetryRequestSchema, sourceOutputExportRequestSchema, sourceOutputManifestSchema } from '../shared/contracts.js';
import { CatalogService, proofStatusAllowsPrivilegedAction, proofStatusBlockMessage } from './catalog-service.js';
import { HistoryService } from './history-service.js';
import { SettingsService } from './settings-service.js';
import {
  TerminalEventBudget,
  WindowsSandboxGuestTransport,
  cleanupOwnedWorkspace,
  createIsolationAttestationChallenge,
  createSourceExecutionPlan,
  isolationMatches,
  resolveOwnedPath,
  sourceRecipeCatalogSchema,
  validateIsolationAttestation,
  validateCapabilityLease,
  type IsolationBroker,
  type IsolationCapabilityLease,
  type RuntimeLine,
  type SourceRecipe,
  runtimeLineSchema,
  SOURCE_RUNTIME_LIMITS,
  verifyOwnedDirectChild,
  verifyOwnedRoot,
  type SourceExecutionResult,
} from './source-runtime.js';

interface ActiveJob {
  jobId: string;
  appId: string;
  displayName: string;
  workspaceName: string;
  controller: AbortController;
  budget: TerminalEventBudget;
  lease?: IsolationCapabilityLease;
  teardown?: Promise<void>;
  leasedTeardown?: Promise<void>;
  output?: SourceOutputManifest;
  disposalReceipt?: SourceDisposalReceipt;
}

interface CompletedJob {
  request: SourceJobRequest;
  state: 'succeeded' | 'failed' | 'cancelled';
  retries: number;
}

export class SourceJobService {
  private readonly active = new Map<string, ActiveJob>();
  private readonly activeApps = new Map<string, string>();
  private readonly startingApps = new Set<string>();
  private readonly completed = new Map<string, CompletedJob>();
  private recipes: Map<string, SourceRecipe> | null = null;
  private readonly outputManifests = new Map<string, SourceOutputManifest>();
  private readonly outputPayloads = new Map<string, Map<string, Buffer>>();

  constructor(
    private readonly catalog: CatalogService,
    private readonly history: HistoryService,
    private readonly settings: SettingsService,
    private readonly ownedRoot: string,
    private readonly recipeFile: string,
    private readonly broker: IsolationBroker = new WindowsSandboxGuestTransport(),
    private readonly publish: (event: Readonly<SourceTerminalEvent>) => void = () => undefined,
    private readonly jobTimeoutMs = SOURCE_RUNTIME_LIMITS.maxJobMs,
  ) {}

  async isolationStatus() {
    if (this.broker.diagnose) return this.broker.diagnose();
    return {
      available: false as const,
      provider: 'windows-sandbox' as const,
      reason: 'guest-transport-not-connected' as const,
      checkedAt: new Date().toISOString(),
      evidence: ['The configured source broker does not expose a guest capability report.'],
      remediation: 'Keep source execution disabled until a reviewed disposable guest transport is connected.',
    };
  }

  async start(input: unknown): Promise<SourceJobStartResult> {
    const parsed = sourceJobRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, appId: 'invalid', state: 'failed', message: 'Invalid source job request. Only a catalog application ID and build/run decision are accepted.' };
    const request: SourceJobRequest = parsed.data;
    if (this.broker.recoverOrphans) await this.broker.recoverOrphans();
    await this.recoverOrphanedWorkspaces();
    if (this.active.size + this.startingApps.size >= 1 || this.startingApps.has(request.appId)) {
      return { ok: false, appId: request.appId, state: 'failed', message: 'The disposable runner is at its verified one-job capacity. Wait for the active source job to finish.' };
    }
    this.startingApps.add(request.appId);
    try {
    if (!(await this.settings.load()).automaticRepairConsent) {
      return { ok: false, appId: request.appId, state: 'failed', message: 'Automatic source repair consent is not enabled. Review the isolation disclosure in Settings before starting a source job.' };
    }
    let record;
    try {
      record = await this.catalog.recordFor(request.appId);
    } catch {
      return { ok: false, appId: request.appId, state: 'failed', message: 'The requested catalog application is not available.' };
    }
    if (!proofStatusAllowsPrivilegedAction(record.proofStatus)) {
      return { ok: false, appId: record.id, state: 'failed', message: proofStatusBlockMessage(record) };
    }
    if (record.availability !== 'source-build' || record.packageType !== 'source') {
      return { ok: false, appId: request.appId, state: 'failed', message: 'Automatic repair is available only for reviewed source recipes; ordinary release installation never invokes OpenCode.' };
    }
    if (this.activeApps.has(request.appId)) {
      return { ok: false, appId: request.appId, jobId: this.activeApps.get(request.appId), state: 'failed', message: `${record.displayName} already has a source job in progress.` };
    }

    let recipe: SourceRecipe | undefined;
    try { recipe = (await this.loadRecipes()).get(request.appId); }
    catch (error) { return { ok: false, appId: request.appId, state: 'failed', message: `The reviewed source recipe catalog is invalid: ${(error as Error).message}` }; }
    if (!recipe || recipe.repository !== `Ding-Ding-Projects/${record.repository}`) {
      return { ok: false, appId: request.appId, state: 'failed', message: 'No reviewed pinned source recipe is available for this application. Nothing was executed.' };
    }
    if (request.decision === 'run' && recipe.run.length === 0) {
      return { ok: false, appId: request.appId, state: 'failed', message: 'This reviewed source recipe does not expose a run operation.' };
    }

    const jobId = randomUUID();
    const workspaceName = `job-${jobId}`;
    let workspace = resolveOwnedPath(this.ownedRoot, workspaceName);
    try {
      await mkdir(this.ownedRoot, { recursive: true });
      const ownedRoot = await verifyOwnedRoot(this.ownedRoot);
      workspace = resolveOwnedPath(ownedRoot, workspaceName);
      await mkdir(workspace, { recursive: false });
      workspace = await verifyOwnedDirectChild(ownedRoot, workspaceName);
      await writeFile(path.join(workspace, '.ding-ding-source-job'), jobId, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      return { ok: false, appId: request.appId, state: 'failed', message: `The app-owned disposable workspace could not be created: ${(error as Error).message}` };
    }
    const job: ActiveJob = {
      jobId,
      appId: request.appId,
      displayName: record.displayName,
      workspaceName,
      controller: new AbortController(),
      budget: new TerminalEventBudget(jobId, request.appId, workspace),
    };
    this.active.set(jobId, job);
    this.activeApps.set(request.appId, jobId);
    this.emit(job, { stream: 'system', state: 'queued', text: `${request.decision === 'build' ? 'Build' : 'Run'} job queued in an app-owned disposable workspace.`, progress: 0 });
    void this.execute(jobId, request, recipe);
    return { ok: true, appId: request.appId, jobId, state: 'queued', message: `${record.displayName} source ${request.decision} started.` };
    } finally {
      this.startingApps.delete(request.appId);
    }
  }

  async cancel(input: unknown): Promise<SourceJobStartResult> {
    const parsed = sourceJobCancelRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, appId: 'invalid', state: 'failed', message: 'Invalid source job cancellation request.' };
    const request: SourceJobCancelRequest = parsed.data;
    const job = this.active.get(request.jobId);
    if (!job) return { ok: false, appId: 'unknown', jobId: request.jobId, state: 'failed', message: 'That source job is no longer active.' };
    if (job.controller.signal.aborted) return { ok: true, appId: job.appId, jobId: request.jobId, state: 'cancelling', message: 'Cancellation is already in progress.' };
    job.controller.abort();
    this.emit(job, { stream: 'system', state: 'cancelling', text: 'Cancellation requested. The disposable guest is stopping its entire process tree and cleaning up.', progress: null });
    await this.teardown(job, request.jobId);
    return { ok: true, appId: job.appId, jobId: request.jobId, state: 'cancelled', message: 'Cancellation requested.' };
  }

  async retry(input: unknown): Promise<SourceJobStartResult> {
    const parsed = sourceJobRetryRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, appId: 'invalid', state: 'failed', message: 'Invalid source job retry request.' };
    const request: SourceJobRetryRequest = parsed.data;
    const previous = this.completed.get(request.jobId);
    if (!previous || previous.state === 'succeeded') {
      return { ok: false, appId: 'unknown', jobId: request.jobId, state: 'failed', message: 'That source job cannot be retried. Only a failed or cancelled job may be retried.' };
    }
    if (previous.retries >= 2) {
      return { ok: false, appId: 'unknown', jobId: request.jobId, state: 'failed', message: 'This source job has reached its automatic retry limit.' };
    }
    const result = await this.start(previous.request);
    if (result.ok && result.jobId) {
      this.completed.set(result.jobId, { request: previous.request, state: 'failed', retries: previous.retries + 1 });
    }
    return result;
  }

  async outputs(jobId: string): Promise<SourceOutputManifest | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)) return null;
    return this.outputManifests.get(jobId) ?? null;
  }

  async exportOutput(input: unknown, destination?: string): Promise<SourceOutputExportResult> {
    const parsed = sourceOutputExportRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, format: 'json', suggestedName: 'source-output.json', message: 'The source output export request was invalid.' };
    const request: SourceOutputExportRequest = parsed.data;
    const manifest = this.outputManifests.get(request.jobId);
    const suggestedName = request.format === 'json' ? `source-output-${request.jobId}.json` : `source-output-${request.jobId}.zip`;
    if (!manifest) return { ok: false, format: request.format, suggestedName, message: 'No retained output manifest exists for that source job.' };
    const manifestJson = Buffer.from(JSON.stringify({ schema: 'ding-ding-app-store.source-output.v1', manifest, omittedFields: ['hostPaths', 'credentials', 'secrets'] }, null, 2) + '\n', 'utf8');
    const content = request.format === 'json' ? manifestJson : await this.zipOutput(manifestJson, this.outputPayloads.get(request.jobId));
    if (!destination) return { ok: true, format: request.format, suggestedName, bytes: content.length, sha256: (await import('node:crypto')).createHash('sha256').update(content).digest('hex'), message: 'Source output export is ready for the native save dialog.' };
    await writeFile(destination, content, { flag: 'wx' });
    return { ok: true, format: request.format, suggestedName, bytes: content.length, sha256: (await import('node:crypto')).createHash('sha256').update(content).digest('hex'), message: `Source output exported to ${request.format.toUpperCase()} without exposing host paths.` };
  }

  private async zipOutput(manifest: Buffer, payloads: Map<string, Buffer> | undefined): Promise<Buffer> {
    return await new Promise<Buffer>((resolve, reject) => {
      const zip = new ZipFile();
      const chunks: Buffer[] = [];
      zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      zip.outputStream.once('error', reject);
      zip.outputStream.once('end', () => resolve(Buffer.concat(chunks)));
      zip.addBuffer(manifest, 'manifest.json');
      for (const [filePath, bytes] of payloads ?? []) {
        if (/^[A-Za-z0-9][A-Za-z0-9._/-]{0,239}$/.test(filePath)) zip.addBuffer(bytes, `outputs/${filePath}`);
      }
      zip.end();
    });
  }

  private async recoverOrphanedWorkspaces(): Promise<void> {
    let entries: string[];
    try { entries = await readdir(this.ownedRoot); } catch { return; }
    for (const name of entries) {
      if (!/^[A-Za-z0-9-]+$/.test(name) || [...this.active.values()].some((job: ActiveJob) => job.workspaceName === name)) continue;
      try {
        const marker = (await readFile(resolveOwnedPath(this.ownedRoot, `${name}/.ding-ding-source-job`), 'utf8')).trim();
        if (/^[0-9a-f-]{36}$/i.test(marker)) await cleanupOwnedWorkspace(this.ownedRoot, name, marker);
      } catch { /* An unsafe orphan remains for the next bounded recovery pass. */ }
    }
  }

  private async loadRecipes(): Promise<Map<string, SourceRecipe>> {
    if (this.recipes) return this.recipes;
    const parsed = sourceRecipeCatalogSchema.parse(JSON.parse(await readFile(this.recipeFile, 'utf8')));
    this.recipes = new Map(parsed.recipes.map((recipe) => [recipe.appId, recipe]));
    return this.recipes;
  }

  private emit(job: ActiveJob, line: RuntimeLine, final = false): void {
    const parsed = runtimeLineSchema.safeParse(line);
    if (!parsed.success) return;
    const event = job.budget.next(parsed.data, final);
    if (event) this.publish(event);
  }

  private async teardown(job: ActiveJob, jobId: string): Promise<void> {
    if (job.lease) {
      if (!job.leasedTeardown) job.leasedTeardown = this.broker.dispose(jobId, job.lease).then((receipt) => { if (receipt) job.disposalReceipt = receipt; });
      await job.leasedTeardown;
      return;
    }
    if (!job.teardown) job.teardown = this.broker.abort(jobId);
    await job.teardown;
  }

  private async execute(jobId: string, request: SourceJobRequest, recipe: SourceRecipe): Promise<void> {
    const job = this.active.get(jobId);
    if (!job) return;
    let ok = false;
    let message = '';
    let finalState: 'succeeded' | 'failed' | 'cancelled' = 'failed';
    let timedOut = false;
    const deadline = Date.now() + this.jobTimeoutMs;
    const withinDeadline = async <T>(work: Promise<T>): Promise<T> => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) { timedOut = true; throw new Error('The source job exceeded its global safety limit.'); }
      let timer: NodeJS.Timeout | undefined;
      return await Promise.race([
        work,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            job.controller.abort();
            reject(new Error('The source job exceeded its global safety limit and the disposable guest is being terminated.'));
          }, remaining);
        }),
      ]).finally(() => { if (timer) clearTimeout(timer); });
    };
    try {
      this.emit(job, { stream: 'progress', state: 'preparing', text: 'Checking the hard-disposable isolation boundary before any source or OpenCode execution.', progress: 5 });
      const identity = this.broker.identity?.() ?? null;
      if (!identity) {
        const status = await withinDeadline(this.isolationStatus());
        this.emit(job, { stream: 'stderr', state: 'failed', text: `Source execution withheld: ${status.reason}. ${status.evidence.join(' ')}`, progress: null });
        throw new Error(`The hard-disposable runner is unavailable (${status.reason}). No source code or blanket-approved OpenCode ran on the host.`);
      }
      const challenge = createIsolationAttestationChallenge(jobId, Math.max(1, deadline - Date.now()), identity, Date.now());
      const validation = validateIsolationAttestation(await withinDeadline(this.broker.attest(challenge, job.controller.signal)), challenge, Date.now());
      if (!validation.ok) {
        const status = await withinDeadline(this.isolationStatus());
        this.emit(job, { stream: 'stderr', state: 'failed', text: `Source execution withheld: ${status.reason}. Broker attestation was rejected (${validation.reason}). ${status.evidence.join(' ')}`, progress: null });
        throw new Error(`The hard-disposable runner is unavailable (${status.reason}; ${validation.reason}). No source code or blanket-approved OpenCode ran on the host.`);
      }
      const attestation = validation.attestation;
      if (!isolationMatches(attestation) || !validateCapabilityLease(attestation.lease, challenge, 'execute') || !validateCapabilityLease(attestation.lease, challenge, 'dispose')) {
        throw new Error('The hard-disposable runner returned an incomplete capability lease. No source code ran.');
      }
      job.lease = attestation.lease;
      if (job.controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const plan = createSourceExecutionPlan(jobId, request.decision, recipe);
      this.emit(job, { stream: 'progress', state: 'preparing', text: `Pinned revision ${recipe.revision.slice(0, 12)} and reviewed command vectors accepted.`, progress: 10 });
      const execution = await withinDeadline(this.broker.execute(plan, (line) => this.emit(job, line), job.controller.signal, attestation.lease));
      this.retainOutputs(job, recipe, request.decision, execution);
      if (job.controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      ok = true;
      message = `${job.displayName} source ${request.decision} completed in the disposable runner and expected outputs were validated.`;
      finalState = 'succeeded';
    } catch (error) {
      const cancelled = !timedOut && (job.controller.signal.aborted || (error as Error).name === 'AbortError');
      message = cancelled ? `${job.displayName} source ${request.decision} was cancelled.` : (error as Error).message;
      finalState = cancelled ? 'cancelled' : 'failed';
    } finally {
      try {
        await this.teardown(job, jobId);
      } catch (disposeError) {
        ok = false;
        finalState = 'failed';
        message = `${message} Disposable guest disposal failed: ${(disposeError as Error).message}`.trim();
      }
      try {
        await cleanupOwnedWorkspace(this.ownedRoot, job.workspaceName, jobId);
      } catch (cleanupError) {
        this.emit(job, { stream: 'stderr', state: ok ? 'failed' : 'failed', text: `Owned workspace cleanup failed: ${(cleanupError as Error).message}`, progress: null }, true);
        ok = false;
        message = `${message} Owned workspace cleanup failed.`;
        finalState = 'failed';
      }
      try {
        await this.history.record({ appId: job.appId, displayName: job.displayName, kind: 'build', ok, message });
      } catch {
        // The source outcome remains honest in the terminal even if optional local history cannot be written.
      }
      this.emit(job, { stream: finalState === 'failed' ? 'stderr' : 'system', state: finalState, text: message, progress: finalState === 'succeeded' ? 100 : null }, true);
      this.active.delete(jobId);
      this.activeApps.delete(job.appId);
      this.completed.set(jobId, { request, state: finalState, retries: this.completed.get(jobId)?.retries ?? 0 });
      while (this.completed.size > 32) this.completed.delete(this.completed.keys().next().value!);
    }
  }

  private retainOutputs(job: ActiveJob, recipe: SourceRecipe, decision: SourceJobRequest['decision'], result: SourceExecutionResult | void): void {
    if (!result) return;
    const supplied = result.outputManifest ?? (result.outputs ? {
      schemaVersion: 1 as const,
      jobId: job.jobId,
      appId: recipe.appId,
      revision: recipe.revision,
      decision,
      generatedAt: new Date().toISOString(),
      totalBytes: result.outputs.reduce((sum, file) => sum + file.bytes, 0),
      files: result.outputs.map(({ content: _content, ...file }) => file),
    } : undefined);
    if (!supplied) return;
    const parsed = sourceOutputManifestSchema.safeParse(supplied);
    if (!parsed.success || parsed.data.jobId !== job.jobId || parsed.data.appId !== recipe.appId || parsed.data.revision !== recipe.revision || parsed.data.decision !== decision) return;
    if (result.outputs?.some((file) => file.content && (file.content.length !== file.bytes || (awaitHash(file.content) !== file.sha256)))) return;
    job.output = parsed.data;
    this.outputManifests.set(parsed.data.jobId, parsed.data);
    if (result.outputs) this.outputPayloads.set(parsed.data.jobId, new Map(result.outputs.filter((file) => file.content).map((file) => [file.path, file.content!] )));
  }
}

function awaitHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

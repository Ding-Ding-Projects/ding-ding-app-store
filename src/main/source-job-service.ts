import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SourceJobCancelRequest, SourceJobRequest, SourceJobStartResult, SourceTerminalEvent } from '../shared/contracts.js';
import { sourceJobCancelRequestSchema, sourceJobRequestSchema } from '../shared/contracts.js';
import { CatalogService } from './catalog-service.js';
import { HistoryService } from './history-service.js';
import { SettingsService } from './settings-service.js';
import {
  TerminalEventBudget,
  UnavailableIsolationBroker,
  cleanupOwnedWorkspace,
  createSourceExecutionPlan,
  isolationMatches,
  resolveOwnedPath,
  sourceRecipeCatalogSchema,
  type IsolationBroker,
  type RuntimeLine,
  type SourceRecipe,
  runtimeLineSchema,
  SOURCE_RUNTIME_LIMITS,
} from './source-runtime.js';

interface ActiveJob {
  appId: string;
  displayName: string;
  workspaceName: string;
  controller: AbortController;
  budget: TerminalEventBudget;
}

export class SourceJobService {
  private readonly active = new Map<string, ActiveJob>();
  private readonly activeApps = new Map<string, string>();
  private readonly startingApps = new Set<string>();
  private recipes: Map<string, SourceRecipe> | null = null;

  constructor(
    private readonly catalog: CatalogService,
    private readonly history: HistoryService,
    private readonly settings: SettingsService,
    private readonly ownedRoot: string,
    private readonly recipeFile: string,
    private readonly broker: IsolationBroker = new UnavailableIsolationBroker(),
    private readonly publish: (event: Readonly<SourceTerminalEvent>) => void = () => undefined,
    private readonly jobTimeoutMs = SOURCE_RUNTIME_LIMITS.maxJobMs,
  ) {}

  async start(input: unknown): Promise<SourceJobStartResult> {
    const parsed = sourceJobRequestSchema.safeParse(input);
    if (!parsed.success) return { ok: false, appId: 'invalid', state: 'failed', message: 'Invalid source job request. Only a catalog application ID and build/run decision are accepted.' };
    const request: SourceJobRequest = parsed.data;
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
    const workspace = resolveOwnedPath(this.ownedRoot, workspaceName);
    try {
      await mkdir(this.ownedRoot, { recursive: true });
      await mkdir(workspace, { recursive: false });
      await writeFile(path.join(workspace, '.ding-ding-source-job'), jobId, { encoding: 'utf8', flag: 'wx' });
    } catch (error) {
      return { ok: false, appId: request.appId, state: 'failed', message: `The app-owned disposable workspace could not be created: ${(error as Error).message}` };
    }
    const job: ActiveJob = {
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
    await this.broker.dispose(request.jobId).catch(() => undefined);
    return { ok: true, appId: job.appId, jobId: request.jobId, state: 'cancelled', message: 'Cancellation requested.' };
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
      const attestation = await withinDeadline(this.broker.attest());
      if (!isolationMatches(attestation)) throw new Error('The hard-disposable runner is unavailable or failed isolation attestation. No source code or blanket-approved OpenCode ran on the host.');
      if (job.controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const plan = createSourceExecutionPlan(jobId, request.decision, recipe);
      this.emit(job, { stream: 'progress', state: 'preparing', text: `Pinned revision ${recipe.revision.slice(0, 12)} and reviewed command vectors accepted.`, progress: 10 });
      await withinDeadline(this.broker.execute(plan, (line) => this.emit(job, line), job.controller.signal));
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
        await this.broker.dispose(jobId);
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
    }
  }
}

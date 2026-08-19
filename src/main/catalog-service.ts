import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import semver from 'semver';
import { z } from 'zod';
import type { Availability, CatalogApp, CatalogSnapshot, InstalledAppRecord, PackageType, ScheduleTaskResult } from '../shared/contracts.js';
import { adapterFor, installAdapterIdSchema } from './install-adapters.js';
import { readJson, writeJsonAtomic } from './json-store.js';

const ORG = 'Ding-Ding-Projects';
const API_ORIGIN = 'https://api.github.com';
const CACHE_MAX_AGE_MS = 30 * 60 * 1000;

const iconMetadataSchema = z.strictObject({
  source: z.literal('repository'),
  path: z.string().regex(/^(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.(?:ico|png|svg)$/),
  provenance: z.literal('first-party-reviewed'),
  fallback: z.enum(['generated-monogram', 'catalog-mark']),
  evidence: z.string().min(1).max(240),
});

const sourceMetadataSchema = z.strictObject({
  organization: z.literal(ORG),
  repository: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  defaultBranch: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  public: z.literal(true),
  sourceKind: z.literal('public-repository'),
});

const catalogRecordSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/),
  repository: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  displayName: z.string().min(1).max(80),
  availability: z.enum(['installable', 'source-build', 'documentation-only', 'unsupported']),
  packageType: z.enum(['squirrel', 'msi', 'nsis', 'inno', 'jpackage', 'archive', 'source', 'unsupported']),
  adapterId: installAdapterIdSchema,
  wiki: z.boolean(),
  sourceManifest: z.string().max(180).nullable(),
  icon: iconMetadataSchema.optional(),
  iconProvenance: iconMetadataSchema.optional(),
  sourceMetadata: sourceMetadataSchema.optional(),
  proofStatus: z.enum(['not-required', 'blocked-until-proof', 'verified']).optional(),
  proofTargetId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/).nullable().optional(),
}).strict().superRefine((record, context) => {
  const adapter = adapterFor(record.id);
  if (adapter.id !== record.adapterId) context.addIssue({ code: 'custom', path: ['adapterId'], message: 'Adapter ID does not match the application.' });
  const expectedAvailability = adapter.supported ? 'installable' : 'unsupported';
  if (record.availability !== expectedAvailability) context.addIssue({ code: 'custom', path: ['availability'], message: `Adapter requires ${expectedAvailability}.` });
  if (record.packageType !== adapter.packageType) context.addIssue({ code: 'custom', path: ['packageType'], message: 'Package type does not match the reviewed adapter.' });
});

const catalogFileSchema = z.object({
  schemaVersion: z.literal(1),
  organization: z.literal(ORG),
  apps: z.array(catalogRecordSchema).min(1).max(100),
});

const repoSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  html_url: z.string().url(),
  homepage: z.string().url().nullable().or(z.literal('')),
  default_branch: z.string(),
  topics: z.array(z.string()).default([]),
  stargazers_count: z.number().int().nonnegative(),
  updated_at: z.string(),
  private: z.boolean(),
  archived: z.boolean(),
});

const assetSchema = z.object({
  name: z.string(),
  browser_download_url: z.string().url(),
  size: z.number().int().nonnegative(),
  digest: z.string().nullable().optional(),
});

const releaseSchema = z.object({
  tag_name: z.string(),
  html_url: z.string().url(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  assets: z.array(assetSchema),
});

export type CatalogRecord = z.infer<typeof catalogRecordSchema>;
export type ReleaseAsset = z.infer<typeof assetSchema>;
export type ReleaseRecord = z.infer<typeof releaseSchema>;

interface CachedCatalog extends CatalogSnapshot {
  fetchedAt: string;
}

function dataPath(): string {
  return path.join(app.getAppPath(), 'data', 'catalog.v1.json');
}

async function fetchJson(url: URL): Promise<unknown> {
  if (url.origin !== API_ORIGIN) throw new Error(`Blocked catalog origin: ${url.origin}`);
  const response = await fetch(url, {
    redirect: 'error',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Ding-Ding-App-Store',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Catalog request failed: HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > 2_000_000) throw new Error('Catalog response exceeded 2 MB.');
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('Catalog response exceeded 2 MB.');
  return JSON.parse(text) as unknown;
}

function compareVersion(installed: string | null, latest: string | null): CatalogApp['updateState'] {
  if (!installed || !latest) return latest ? 'unknown' : 'unsupported';
  const left = semver.coerce(installed);
  const right = semver.coerce(latest);
  if (!left || !right) return 'failed';
  return semver.lt(left, right) ? 'available' : 'up-to-date';
}

export function applyVerifiedInstalledState(
  apps: readonly CatalogApp[],
  installed: readonly Pick<InstalledAppRecord, 'appId' | 'version'>[],
): CatalogApp[] {
  const versions = new Map(installed.map((record) => [record.appId, record.version]));
  return apps.map((record) => {
    const installedVersion = versions.get(record.id) ?? null;
    return { ...record, installedVersion, updateState: compareVersion(installedVersion, record.latestVersion) };
  });
}

export class CatalogService {
  private readonly cachePath = path.join(app.getPath('userData'), 'catalog-cache.v1.json');
  private installedProvider: () => Promise<InstalledAppRecord[]> = async () => [];

  setInstalledProvider(provider: () => Promise<InstalledAppRecord[]>): void {
    this.installedProvider = provider;
  }

  async manifest(): Promise<z.infer<typeof catalogFileSchema>> {
    return catalogFileSchema.parse(JSON.parse(await readFile(dataPath(), 'utf8')));
  }

  async list(force = false): Promise<CatalogSnapshot> {
    const cached = await readJson<CachedCatalog | null>(this.cachePath, null);
    if (!force && cached && Date.now() - Date.parse(cached.fetchedAt) < CACHE_MAX_AGE_MS) {
      return await this.withVerifiedInstalledState({ ...cached, source: 'cache' });
    }

    try {
      const snapshot = await this.fetchCatalog();
      await writeJsonAtomic(this.cachePath, snapshot);
      return await this.withVerifiedInstalledState(snapshot);
    } catch (error) {
      if (cached) {
        return await this.withVerifiedInstalledState({
          ...cached,
          source: 'cache',
          warning: `Live refresh failed; showing cached catalog. ${(error as Error).message}`,
        });
      }
      throw error;
    }
  }

  private async withVerifiedInstalledState(snapshot: CatalogSnapshot): Promise<CatalogSnapshot> {
    let installed: InstalledAppRecord[] = [];
    let warning = snapshot.warning;
    try {
      installed = await this.installedProvider();
    } catch (error) {
      warning = `${warning ? `${warning} ` : ''}Installed-state verification failed; no installed actions are shown. ${(error as Error).message}`;
    }
    return {
      ...snapshot,
      warning,
      apps: applyVerifiedInstalledState(snapshot.apps, installed),
    };
  }

  async runScheduled(): Promise<ScheduleTaskResult> {
    try {
      const snapshot = await this.list(true);
      if (snapshot.warning !== null) return { outcome: 'failed', message: snapshot.warning };
      return { outcome: 'ok', message: `Refreshed ${snapshot.apps.length} apps.` };
    } catch (error) {
      return { outcome: 'failed', message: (error as Error).message };
    }
  }

  private async fetchCatalog(): Promise<CatalogSnapshot> {
    const manifest = await this.manifest();
    const repositories = z.array(repoSchema).parse(
      await fetchJson(new URL(`/orgs/${ORG}/repos?type=public&sort=full_name&per_page=100`, API_ORIGIN)),
    );
    const repoMap = new Map(repositories.filter((repo) => !repo.private && !repo.archived).map((repo) => [repo.name, repo]));
    const apps = await Promise.all(manifest.apps.map(async (record): Promise<CatalogApp> => {
      const repo = repoMap.get(record.repository);
      if (!repo) {
        return {
          id: record.id,
          name: record.displayName,
          repository: record.repository,
          description: 'This curated application is temporarily unavailable from the public organization catalog.',
          homepageUrl: null,
          repositoryUrl: `https://github.com/${ORG}/${record.repository}`,
          defaultBranch: '',
          topics: [],
          stars: 0,
          updatedAt: new Date(0).toISOString(),
          latestVersion: null,
          latestReleaseUrl: null,
          availability: 'unsupported',
          packageType: 'unsupported',
          installedVersion: null,
          updateState: 'failed',
          docsAvailable: record.wiki,
        };
      }

      const release = await this.latestRelease(record.repository).catch(() => null);
      const installedVersion = null;
      const latestVersion = release?.tag_name ?? null;
      return {
        id: record.id,
        name: record.displayName,
        repository: repo.name,
        description: repo.description?.trim() || 'No repository description has been published yet.',
        homepageUrl: repo.homepage || null,
        repositoryUrl: repo.html_url,
        defaultBranch: repo.default_branch,
        topics: repo.topics,
        stars: repo.stargazers_count,
        updatedAt: repo.updated_at,
        latestVersion,
        latestReleaseUrl: release?.html_url ?? null,
        availability: record.availability as Availability,
        packageType: record.packageType as PackageType,
        installedVersion,
        updateState: compareVersion(installedVersion, latestVersion),
        docsAvailable: record.wiki,
      };
    }));

    return {
      apps,
      fetchedAt: new Date().toISOString(),
      source: 'network',
      warning: null,
    };
  }

  async latestRelease(repository: string): Promise<ReleaseRecord | null> {
    const manifest = await this.manifest();
    if (!manifest.apps.some((item) => item.repository === repository)) throw new Error('Repository is not allowlisted.');
    try {
      return releaseSchema.parse(await fetchJson(new URL(`/repos/${ORG}/${repository}/releases/latest`, API_ORIGIN)));
    } catch (error) {
      if ((error as Error).message.includes('HTTP 404')) return null;
      throw error;
    }
  }

  async recordFor(appId: string): Promise<CatalogRecord> {
    const record = (await this.manifest()).apps.find((item) => item.id === appId);
    if (!record) throw new Error('Application is not allowlisted.');
    return record;
  }
}

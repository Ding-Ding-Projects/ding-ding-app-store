import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const electronState = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => electronState.userData, getAppPath: () => electronState.userData } }));

import { CatalogService } from '../src/main/catalog-service';

describe('catalog cache stale-ID boundary', () => {
  afterEach(async () => { await rm(electronState.userData, { recursive: true, force: true }); });

  it('drops an unknown cached application instead of throwing or exposing an install path', async () => {
    electronState.userData = await mkdtemp(path.join(os.tmpdir(), 'ding-catalog-cache-'));
    const cached = {
      apps: [{
        id: 'removed-app', name: 'Removed App', repository: 'RemovedApp', description: 'stale', homepageUrl: null,
        repositoryUrl: 'https://github.com/Ding-Ding-Projects/RemovedApp', defaultBranch: 'main', topics: [], stars: 0,
        updatedAt: new Date().toISOString(), latestVersion: 'v1.0.0', latestReleaseUrl: null, availability: 'installable',
        packageType: 'squirrel', installedVersion: 'v0.1.0', updateState: 'available', docsAvailable: false,
        proofStatus: 'verified', proofTargetId: null, launchAvailable: true,
      }],
      fetchedAt: new Date().toISOString(), source: 'network', warning: null,
    };
    await mkdir(electronState.userData, { recursive: true });
    await writeFile(path.join(electronState.userData, 'catalog-cache.v1.json'), JSON.stringify(cached));
    const snapshot = await new CatalogService().list();
    expect(snapshot.apps).toEqual([]);
  });
});

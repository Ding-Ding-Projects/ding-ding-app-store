import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSourceExecutionPlan, sourceRecipeCatalogSchema } from '../src/main/source-runtime.js';

const SELECTED_SOURCE_IDS = [
  'farming-game',
  'material-cookie-clicker',
  'material-encryption',
  'material-ollama',
  'material-sandbox',
  'material-tools',
  'material-virtualbox',
  'material-winforge',
  'material-winutil',
  'meadowmark',
  'minecraft-server-command-center',
  'minecraft-server-studio',
  'sprout-hollow-valley',
] as const;

function assertRecipeCompleteness(recipes: Array<{ appId: string }>): void {
  const ids = recipes.map((recipe) => recipe.appId);
  expect(new Set(ids).size).toBe(ids.length);
  expect([...ids].sort()).toEqual([...SELECTED_SOURCE_IDS].sort());
}

describe('reviewed source recipe catalog', () => {
  it('contains exactly the thirteen selected source-build IDs and validates every pinned row', async () => {
    const file = path.join(process.cwd(), 'data', 'source-recipes.v1.json');
    const parsed = sourceRecipeCatalogSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    assertRecipeCompleteness(parsed.recipes);
    for (const recipe of parsed.recipes) {
      expect(recipe.revision).toMatch(/^[a-f0-9]{40}$/);
      expect(recipe.sourceArchiveSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(recipe.readiness.timeoutMs).toBeGreaterThan(0);
      if (recipe.status === 'ready') {
        expect(recipe.validate.length).toBeGreaterThan(0);
        expect(recipe.build.length).toBeGreaterThan(0);
        expect(recipe.dependencies.length).toBeGreaterThan(0);
        const plan = createSourceExecutionPlan('00000000-0000-4000-8000-000000000001', 'build', recipe);
        expect(plan.sourceArchiveUrl).toBe(`https://${recipe.repository.replace('Ding-Ding-Projects/', 'github.com/Ding-Ding-Projects/')}/archive/${recipe.revision}.zip`);
        expect(plan.readiness).toEqual(recipe.readiness);
      } else {
        expect(recipe.blocker).toBeTruthy();
        expect([...recipe.prepare, ...recipe.validate, ...recipe.build, ...recipe.test, ...recipe.run]).toHaveLength(0);
        expect(recipe.readiness.target).toBe('not-applicable');
        expect(recipe.finalOutputs).toEqual([]);
      }
    }
  });

  it('has a negative completeness regression: removing one exact row turns the guard red', () => {
    const complete = SELECTED_SOURCE_IDS.map((appId) => ({ appId }));
    expect(() => assertRecipeCompleteness(complete)).not.toThrow();
    const missing = complete.filter((recipe) => recipe.appId !== 'material-tools');
    expect(() => assertRecipeCompleteness(missing)).toThrow();
    expect(() => assertRecipeCompleteness([...missing, { appId: 'material-tools' }])).not.toThrow();
  });

  it('keeps blocked rows explicit and rejects a ready row with no executable build', () => {
    const parsed = sourceRecipeCatalogSchema.parse({
      schemaVersion: 1,
      recipes: [{
        schemaVersion: 1,
        status: 'blocked',
        blocker: 'Native toolchain and output proof are missing.',
        appId: 'blocked-app',
        repository: 'Ding-Ding-Projects/blocked-app',
        revision: '1'.repeat(40),
        sourceArchiveSha256: '2'.repeat(64),
        dependencies: [], prepare: [], validate: [], build: [], test: [], run: [],
        readiness: { kind: 'output-files', target: 'not-applicable', timeoutMs: 30_000 },
        repairableStepIds: [], finalOutputs: [], repairAttempts: 0,
      }],
    });
    expect(parsed.recipes[0]?.status).toBe('blocked');
    const ready = { ...parsed.recipes[0], status: 'ready' as const };
    expect(sourceRecipeCatalogSchema.safeParse({ schemaVersion: 1, recipes: [ready] }).success).toBe(false);
  });

  it('keeps the four native/verification blockers evidence-backed and non-executable', async () => {
    const parsed = sourceRecipeCatalogSchema.parse(JSON.parse(await readFile(path.join(process.cwd(), 'data', 'source-recipes.v1.json'), 'utf8')));
    const expected = new Map([
      ['material-encryption', ['package.json', 'sharp', 'Electron', 'clean-Windows']],
      ['material-ollama', ['package.json', 'CMakeLists.txt', 'go.mod', 'CMake', 'Go']],
      ['material-sandbox', ['SandMan-Qt6.qc.pro', 'vcxproj', 'Qt', 'Windows Driver Kit']],
      ['material-virtualbox', ['build-windows.ps1', 'configure.py', 'kBuild', 'MSVC']],
    ]);
    for (const [appId, evidence] of expected) {
      const recipe = parsed.recipes.find((entry) => entry.appId === appId);
      expect(recipe?.status).toBe('blocked');
      expect(recipe?.blocker).toBeTruthy();
      expect(recipe?.finalOutputs).toEqual([]);
      for (const needle of evidence) expect(recipe?.blocker).toContain(needle);
    }
  });

  it('pins the four shard-13 source routes to their verified archive contracts', async () => {
    const parsed = sourceRecipeCatalogSchema.parse(JSON.parse(await readFile(path.join(process.cwd(), 'data', 'source-recipes.v1.json'), 'utf8')));
    const expected = new Map([
      ['meadowmark', ['a296fe73ca28b87942f01463893fcfbe4c98b593', '7312c8333b8b0c874817a3442f3e273be037eac0703632266980603aabb50f10']],
      ['minecraft-server-command-center', ['cada16999d73e19d6461fc97c0511eab5d18eb63', 'aa586b272bcaa3f1ac3592405e83aaf5354fa5672b48b65ac9550cde3fe48aae']],
      ['minecraft-server-studio', ['106aca7e2da0b8d788d1f7a8343571f7fffa2a6d', 'b35c0d305d3fc4ef7707341198266c72d59e2a2e34017126a8a4e3ae305844b7']],
      ['sprout-hollow-valley', ['f0302b43ec3d0fda9fb159ef6be7607a71967ccc', 'a830492b1337813db72ce3b46fe309ab83220e39799b31baecab773a171a9c29']],
    ]);
    for (const [appId, [revision, digest]] of expected) {
      expect(parsed.recipes.find((recipe) => recipe.appId === appId)).toMatchObject({
        status: 'ready', revision, sourceArchiveSha256: digest,
      });
    }
    const meadow = parsed.recipes.find((recipe) => recipe.appId === 'meadowmark');
    expect(meadow?.validate).toEqual([expect.objectContaining({
      id: 'validate-types',
      arguments: ['toolchain/node/node_modules/npm/bin/npm-cli.js', 'run', 'typecheck', '--workspaces', '--if-present'],
    })]);
  });
});

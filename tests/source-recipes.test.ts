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
        readiness: { kind: 'output-files', target: 'dist/app.exe', timeoutMs: 30_000 },
        repairableStepIds: [], finalOutputs: ['dist/app.exe'], repairAttempts: 0,
      }],
    });
    expect(parsed.recipes[0]?.status).toBe('blocked');
    const ready = { ...parsed.recipes[0], status: 'ready' as const };
    expect(sourceRecipeCatalogSchema.safeParse({ schemaVersion: 1, recipes: [ready] }).success).toBe(false);
  });
});

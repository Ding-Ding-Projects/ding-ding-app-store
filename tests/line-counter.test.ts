import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

describe('committed release line counter', () => {
  it('keeps project attribution arithmetic exact and exposes exclusions', () => {
    const output = execFileSync(process.execPath, ['scripts/count-lines.mjs', '--json'], { cwd: root, encoding: 'utf8' });
    const report = JSON.parse(output) as {
      rows: Array<{ category: string; total: number }>;
      project: { total: number; nonblank: number; agent: number; people: number; uncommitted: number };
      grand: { total: number };
    };
    expect(report.project.total).toBeGreaterThan(0);
    expect(report.project.nonblank).toBeLessThanOrEqual(report.project.total);
    expect(report.project.agent + report.project.people + report.project.uncommitted).toBe(report.project.total);
    expect(report.grand.total).toBeGreaterThanOrEqual(report.project.total);
    expect(report.rows.some((row) => row.category === 'Excluded lockfiles')).toBe(true);
  }, 30_000);
});

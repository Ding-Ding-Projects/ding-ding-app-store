import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(path, 'utf8');

describe('cloud install adapter proof boundary', () => {
  it('uses the real OperationService, records detection and cleanup, and never invokes source runtime', async () => {
    const script = await read('scripts/prove-install-adapter.mjs');
    expect(script).toContain("const { OperationService } = await import('../dist/main/operation-service.js')");
    expect(script).toContain("operation.install({ appId, decision: 'install' })");
    expect(script).toContain("operation.uninstall({ appId, decision: 'uninstall' })");
    expect(script).toContain("sourceRuntimeInvoked: false");
    expect(script).toContain("schemaVersion: PROOF_SCHEMA");
    expect(script).not.toMatch(/sourceJobs|OpenCode|source-runtime|child_process/);
  });

  it('limits the first cloud proof to the reviewed portable ZIP adapter', async () => {
    const script = await read('scripts/prove-install-adapter.mjs');
    expect(script).toContain("const CLOUD_PROOF_APP_ID = 'dim-sum-atlas'");
    expect(script).toContain("const CLOUD_PROOF_ADAPTER_ID = 'dim-sum-atlas-portable-zip'");
    expect(script).toContain("adapter.family !== 'portable-zip'");
    expect(script).toContain("appId !== CLOUD_PROOF_APP_ID");
    expect(script).toContain("APP_ID_PATTERN");
  });

  it('pins the proof to a Windows cloud runner and uploads only the bounded manifest', async () => {
    const workflow = await read('.github/workflows/install-adapter-proof.yml');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('app_id:');
    expect(workflow).toContain('- dim-sum-atlas');
    expect(workflow).toContain('runs-on: windows-2022');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npx electron scripts/prove-install-adapter.mjs');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('proof-output/install-proof.json');
    expect(workflow).not.toContain('expectation:');
    expect(workflow).not.toContain('ubuntu-latest');
    expect(workflow).not.toContain('source-runtime');
  });
});

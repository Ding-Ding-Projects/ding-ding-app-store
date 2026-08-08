import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(path, 'utf8');

describe('cloud install adapter proof boundary', () => {
  it('uses the real OperationService, records detection and cleanup, and never invokes source runtime', async () => {
    const script = await read('scripts/prove-install-adapter.mjs');
    expect(script).toContain("const { OperationService } = await import('../dist/main/operation-service.js')");
    expect(script).toContain("operationService.install({ appId, decision: 'install' })");
    expect(script).toContain("operationService.uninstall({ appId, decision: 'uninstall' })");
    expect(script).toContain("sourceRuntimeInvoked: false");
    expect(script).toContain("schemaVersion: PROOF_SCHEMA");
    expect(script).not.toMatch(/sourceJobs|OpenCode|source-runtime|child_process/);
  });

  it('limits cloud proof to the reviewed portable ZIP adapters', async () => {
    const script = await read('scripts/prove-install-adapter.mjs');
    expect(script).toContain("'dim-sum-atlas': Object.freeze({ adapterId: 'dim-sum-atlas-portable-zip', family: 'portable-zip' })");
    expect(script).toContain("winforge: Object.freeze({ adapterId: 'winforge-portable-zip', family: 'portable-zip' })");
    expect(script).toContain("wimforge: Object.freeze({ adapterId: 'wimforge-portable-zip', family: 'portable-zip' })");
    expect(script).toContain('Object.hasOwn(CLOUD_PROOF_TARGETS, appId)');
    expect(script).toContain("adapter.family !== target.family");
    expect(script).toContain('setInterval');
    expect(script).toContain('withProofTimeout');
    expect(script).toContain('DING_DING_INSTALL_PROOF_TIMEOUT_MS');
    expect(script).toContain('app.exit(exitCode)');
    expect(script).toContain("logMilestone('electron-readiness-skipped')");
    expect(script).toContain('const repositoryRoot = path.resolve(\'.\')');
    expect(script).toContain('app.getAppPath = () => repositoryRoot');
    expect(script).not.toContain('app.whenReady()');
    expect(script).toContain("app.commandLine.appendSwitch('disable-gpu')");
    expect(script).toContain("app.commandLine.appendSwitch('no-sandbox')");
    expect(script).toContain("APP_ID_PATTERN");
  });

  it('pins the proof to a Windows cloud runner and uploads only the bounded manifest', async () => {
    const workflow = await read('.github/workflows/install-adapter-proof.yml');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('app_id:');
    expect(workflow).toContain('- dim-sum-atlas');
    expect(workflow).toContain('- winforge');
    expect(workflow).toContain('- wimforge');
    expect(workflow).toContain('runs-on: windows-2022');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npx electron scripts/prove-install-adapter.mjs');
    expect(workflow).toContain('timeout-minutes: 25');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('proof-output/install-proof.json');
    expect(workflow).not.toContain('expectation:');
    expect(workflow).not.toContain('ubuntu-latest');
    expect(workflow).not.toContain('source-runtime');
  });
});

import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  guestLifecycleFinalReceiptSchema,
  guestLifecyclePlanSchema,
  guestLifecycleReceiptSchema,
  WINDOWS_SANDBOX_GUEST_BOOTSTRAP,
} from '../src/main/source-runtime.js';

const base = {
  schemaVersion: 1 as const, protocolVersion: 1 as const,
  jobId: '11111111-1111-4111-8111-111111111111', challengeNonce: 'a'.repeat(64), guestId: 'guest-1', planDigest: 'b'.repeat(64),
  appId: 'reviewed-app', expectedPackage: 'Reviewed.App', expectedVersion: '1.2.3', registryDisplayName: 'Reviewed App', squirrelPackageName: 'Reviewed.App', executableFileName: 'Reviewed.exe', executableSha256: 'd'.repeat(64), installIdentity: 'Reviewed.App', executableRelativeName: 'Reviewed.exe', expectedWindowTitle: 'Reviewed App', expectedWindowClass: 'Chrome_WidgetWin_1', readinessTimeoutMs: 10_000, stabilityTimeoutMs: 1_000,
  installer: { format: 'squirrel' as const, bytes: 1024, sha256: 'c'.repeat(64) }, operations: ['squirrel-install', 'squirrel-launch', 'squirrel-uninstall'] as const, maxStageMs: 10_000,
};

describe('guest lifecycle protocol contracts', () => {
  it('requires the exact ordered family operation set', () => {
    expect(guestLifecyclePlanSchema.safeParse(base).success).toBe(true);
    expect(guestLifecyclePlanSchema.safeParse({ ...base, operations: ['squirrel-install', 'squirrel-uninstall', 'squirrel-launch'] }).success).toBe(false);
    expect(guestLifecyclePlanSchema.safeParse({ ...base, operations: ['squirrel-install', 'squirrel-launch'] }).success).toBe(false);
    expect(guestLifecyclePlanSchema.safeParse({ ...base, operations: ['squirrel-install', 'squirrel-launch', 'squirrel-launch'] }).success).toBe(false);
  });

  it('rejects arbitrary paths, families, and oversized installers', () => {
    expect(guestLifecyclePlanSchema.safeParse({ ...base, executableRelativeName: '../evil.exe' }).success).toBe(false);
    expect(guestLifecyclePlanSchema.safeParse({ ...base, installer: { ...base.installer, format: 'custom' } }).success).toBe(false);
    expect(guestLifecyclePlanSchema.safeParse({ ...base, installer: { ...base.installer, bytes: 500 * 1024 * 1024 + 1 } }).success).toBe(false);
  });

  it('requires inner-app facts and never accepts guest disposal claims', () => {
    const receipt = { schemaVersion: 1, protocolVersion: 1, jobId: base.jobId, challengeNonce: base.challengeNonce, guestId: base.guestId, planDigest: base.planDigest, sequence: 3, stage: 'launch' as const, observedAt: new Date().toISOString(), process: { ready: true, windowTitle: 'Reviewed App', windowClass: 'Chrome_WidgetWin_1', hwnd: '0x1234' } };
    expect(guestLifecycleReceiptSchema.safeParse(receipt).success).toBe(true);
    expect(guestLifecycleReceiptSchema.safeParse({ ...receipt, process: { ready: true } }).success).toBe(false);
    expect(guestLifecycleReceiptSchema.safeParse({ ...receipt, guestDeleted: true }).success).toBe(false);
  });

  it('rejects premature final receipts and requires child-process evidence only', () => {
    const final = { schemaVersion: 1, protocolVersion: 1, jobId: base.jobId, challengeNonce: base.challengeNonce, guestId: base.guestId, planDigest: base.planDigest, lastSequence: 6, verdict: true, installIdentity: base.installIdentity, processReady: true, windowTitle: base.expectedWindowTitle, windowClass: base.expectedWindowClass, hwnd: '0x1234', uninstallSucceeded: true, absenceVerified: true, childProcessesStopped: true, observedAt: new Date().toISOString() };
    expect(guestLifecycleFinalReceiptSchema.safeParse(final).success).toBe(true);
    expect(guestLifecycleFinalReceiptSchema.safeParse({ ...final, processTreeStopped: true }).success).toBe(false);
  });

  it('keeps the fixed Squirrel helper source-bound and rejects wrapper readiness', () => {
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('/lifecycle-plan/');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('/stage-receipt/');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('GetWindowThreadProcessId');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('GetClassName');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('ApplicationFrameHost');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain("'--uninstall','-s'");
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('$windowPid');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).not.toContain('$pid =');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('Send-Receipt');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('receiptToken');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('Assert-NoReparse');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('sibling prefixes are not containment');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('Queue[int]');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('ParentProcessId=$parent');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('descendantPids');
    expect(WINDOWS_SANDBOX_GUEST_BOOTSTRAP).toContain('including recursively discovered descendants');
  });

  it('requires an explicit live advertise address instead of selecting a virtual interface', async () => {
    const source = await readFile(new URL('../scripts/prove-guest-lifecycle.mjs', import.meta.url), 'utf8');
    expect(source).toContain("args.get('--advertise-address')");
    expect(source).toContain('An explicit --advertise-address is required');
    expect(source).toContain('availableIpv4Candidates');
    expect(source).not.toContain('chooseHostIpv4');
    expect(source).toContain("args.get('--lowlevel-client')");
    expect(source).toContain("args.get('--run-root')");
    expect(source).toContain("args.get('--sandbox-executable')");
    expect(source).toContain('WindowsSandboxRemoteSession.exe');
    expect(source).toContain("['-3', lowlevelClientPath, 'call'");
    expect(source).toContain("spawn('py', childArgs");
    expect(source).not.toContain("spawn(executable");
    expect(source).toContain("runLowlevel('launch'");
    expect(source).toContain('sandboxExecutable');
    expect(source).toContain('launch-ledger.json');
    expect(source).toContain('schemaVersion: 1, desktop, configPath, runRoot, sandboxExecutable');
    expect(source).toContain('launch-cleanup-unproven');
    expect(source).toContain('process_id');
    expect(source).toContain('WinUIDesktopWin32WindowClass');
    expect(source).toContain("runLowlevelCall('list_processes'");
    expect(source).toContain('name_filter');
    expect(source).not.toContain("force: true }).catch(() => undefined); await runLowlevelCall('close_headless_desktop'");
    expect(source).not.toContain("kill_process', { name");
    expect(source).toContain('WindowsSandboxRemoteSession.exe');
    expect(source).toContain("runLowlevel('cleanup'");
    expect(source).not.toContain('launch_on_headless_desktop');
    expect(source).not.toContain('WindowsSandbox.exe -> WindowsSandboxRemoteSession.exe');
    expect(source).not.toContain('platform: process.platform');
  });

  it('keeps stage and final evidence cross-checks in the protocol peer', async () => {
    const source = await readFile(new URL('../src/main/source-runtime.ts', import.meta.url), 'utf8');
    expect(source).toContain('Installer-bytes receipt did not match the exact plan bytes/hash matrix');
    expect(source).toContain('Install receipt operation/evidence matrix was invalid');
    expect(source).toContain('Launch receipt identity, operation, or process evidence did not match');
    expect(source).toContain('Final lifecycle receipt did not cross-check stored launch, uninstall, absence, and disposal evidence');
  });
});

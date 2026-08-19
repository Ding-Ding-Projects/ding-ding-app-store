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
  appId: 'reviewed-app', expectedPackage: 'Reviewed.App', expectedVersion: '1.2.3', registryDisplayName: 'Reviewed App', squirrelPackageName: 'Reviewed.App', executableFileName: 'Reviewed.exe', installIdentity: 'Reviewed.App', executableRelativeName: 'Reviewed.exe', expectedWindowTitle: 'Reviewed App', expectedWindowClass: 'Chrome_WidgetWin_1', readinessTimeoutMs: 10_000, stabilityTimeoutMs: 1_000,
  installer: { format: 'squirrel' as const, bytes: 1024, sha256: 'c'.repeat(64) }, operations: ['squirrel-install', 'squirrel-launch', 'squirrel-uninstall'] as const, maxStageMs: 10_000, maxBodyBytes: 1_048_576,
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
  });
});

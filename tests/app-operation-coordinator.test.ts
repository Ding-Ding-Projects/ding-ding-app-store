import { describe, expect, it } from 'vitest';
import { AppOperationCoordinator } from '../src/main/app-operation-coordinator';

describe('shared per-application operation barrier', () => {
  it('acquires synchronously and rejects a second mutation before any await', () => {
    const coordinator = new AppOperationCoordinator();
    const first = coordinator.acquire('material-ollama', 'launch');
    expect(first).not.toBeNull();
    expect(coordinator.acquire('material-ollama', 'install')).toBeNull();
    expect(coordinator.isBusy('material-ollama')).toBe(true);
    first?.release();
    expect(coordinator.acquire('material-ollama', 'install')).not.toBeNull();
  });

  it('retains an unknown process outcome and does not allow a later release to clear it', () => {
    const coordinator = new AppOperationCoordinator();
    const lease = coordinator.acquire('material-designer', 'uninstall');
    expect(lease).not.toBeNull();
    lease?.retain();
    lease?.release();
    expect(coordinator.isBusy('material-designer')).toBe(true);
    expect(coordinator.isRetained('material-designer')).toBe(true);
    expect(coordinator.acquire('material-designer', 'launch')).toBeNull();
  });

  it('keeps unrelated applications independent', () => {
    const coordinator = new AppOperationCoordinator();
    const first = coordinator.acquire('material-designer', 'update');
    const second = coordinator.acquire('material-ollama', 'launch');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    first?.release();
    expect(coordinator.isBusy('material-designer')).toBe(false);
    expect(coordinator.isBusy('material-ollama')).toBe(true);
    second?.release();
  });
});

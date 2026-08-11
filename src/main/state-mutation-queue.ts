/**
 * Serializes application-data mutations while allowing a failed operation to
 * leave the queue usable for the next request.
 *
 * History restore and renderer-originated saves share the same files. Keeping
 * this primitive outside Electron makes the ordering contract directly
 * testable without starting a desktop window.
 */
export class StateMutationQueue {
  private tail: Promise<void> = Promise.resolve();
  private barrierGeneration = 0;
  private barrierActive = false;

  /**
   * Starts a restore barrier. New mutations are rejected until the matching
   * token is ended; mutations already in the queue retain their ordering and
   * finish before the barrier operation runs.
   */
  beginBarrier(): number {
    this.barrierGeneration += 1;
    this.barrierActive = true;
    return this.barrierGeneration;
  }

  endBarrier(token: number): void {
    if (token === this.barrierGeneration) this.barrierActive = false;
  }

  private enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  run<T>(operation: () => T | Promise<T>): Promise<T> {
    if (this.barrierActive) {
      const error = new Error('A local history restore is in progress; this state change was not applied.') as Error & { code?: string };
      error.code = 'ESTATE_RESTORE_IN_PROGRESS';
      return Promise.reject(error);
    }
    return this.enqueue(operation);
  }

  /** Runs the restore operation itself while the barrier is active. */
  runBarrier<T>(operation: () => T | Promise<T>): Promise<T> {
    return this.enqueue(operation);
  }
}

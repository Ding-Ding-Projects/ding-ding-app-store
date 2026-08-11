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

  run<T>(operation: () => T | Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
}

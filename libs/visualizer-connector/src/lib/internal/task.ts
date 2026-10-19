/**
 * One-shot readiness gate: resolves with `true` on `complete()` or rejects
 * with a string on `fail()`. Settling twice is a no-op.
 */
export class Task {
  private readonly promise: Promise<boolean>;
  private resolveFn!: (value: boolean) => void;
  private rejectFn!: (reason: string) => void;
  private isSettled = false;

  constructor() {
    this.promise = new Promise<boolean>((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
    });
  }

  /** Resolves the gate with `true`. */
  complete(): void {
    if (this.isSettled) {
      return;
    }
    this.isSettled = true;
    this.resolveFn(true);
  }

  /** Rejects the gate with `reason`. */
  fail(reason = 'Task failed'): void {
    if (this.isSettled) {
      return;
    }
    this.isSettled = true;
    this.rejectFn(reason);
  }

  /** Settles when the gate does. */
  ready(): Promise<boolean> {
    return this.promise;
  }
}

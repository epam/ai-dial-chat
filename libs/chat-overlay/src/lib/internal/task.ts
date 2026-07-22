/**
 * A promise paired with external `resolve`/`reject` control, used internally
 * as a one-shot readiness gate. Settling twice is a no-op.
 */
export class Task<T = void> {
  /** Resolves/rejects exactly once, when the gate is settled. */
  readonly promise: Promise<T>;

  private resolveFn!: (value: T) => void;
  private rejectFn!: (reason?: unknown) => void;
  private settled = false;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
    });
  }

  /** Resolves the gate with `value`. No-op if already settled. */
  resolve(value: T): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.resolveFn(value);
  }

  /** Rejects the gate with `reason`. No-op if already settled. */
  reject(reason?: unknown): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    this.rejectFn(reason);
  }
}

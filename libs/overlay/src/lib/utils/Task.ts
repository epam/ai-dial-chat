export class Task {
  protected promise: Promise<boolean>;
  protected resolve!: (value: boolean) => void;
  protected reject!: (reason: string) => void;

  protected isResolved: boolean;

  constructor() {
    this.isResolved = false;
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  complete() {
    if (this.isResolved) return;

    this.isResolved = true;
    this.resolve(true);
  }

  fail(reason = 'Task failed') {
    if (this.isResolved) return;

    this.reject(reason);
  }

  ready() {
    return this.promise;
  }
}

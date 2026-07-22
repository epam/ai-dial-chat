let requestSequence = 0;

const generateRequestId = (): string => {
  requestSequence += 1;
  return `dial-overlay-${Date.now()}-${requestSequence}`;
};

/**
 * A single outstanding request: owns its `requestId`, races its response
 * promise against a per-request timeout, and rejects with a descriptive
 * error naming the request type and timeout when unanswered in time.
 */
export class DeferredRequest<T = unknown> {
  /** Unique id used to match this request to its response message. */
  readonly requestId: string;
  /** Exact response type expected for this request. */
  readonly responseType: string;
  /** Settles when the matching response arrives, or on timeout/destroy. */
  readonly promise: Promise<T>;

  private resolveFn!: (value: T) => void;
  private rejectFn!: (reason?: unknown) => void;
  private settled = false;
  private readonly timeoutHandle: ReturnType<typeof setTimeout>;

  constructor(requestType: string, timeoutMs: number) {
    this.requestId = generateRequestId();
    this.responseType = `${requestType}/RESPONSE`;
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
    });
    this.timeoutHandle = setTimeout(() => {
      this.reject(
        new Error(
          `ChatOverlay: request "${requestType}" timed out after ${timeoutMs}ms`,
        ),
      );
    }, timeoutMs);
  }

  /** Returns true only for this request's exact response type and id. */
  matches(responseType: string, requestId: string): boolean {
    return this.responseType === responseType && this.requestId === requestId;
  }

  /** Resolves the request with `value`. No-op if already settled. */
  resolve(value: T): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    clearTimeout(this.timeoutHandle);
    this.resolveFn(value);
  }

  /** Rejects the request with `reason`. No-op if already settled. */
  reject(reason?: unknown): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    clearTimeout(this.timeoutHandle);
    this.rejectFn(reason);
  }
}

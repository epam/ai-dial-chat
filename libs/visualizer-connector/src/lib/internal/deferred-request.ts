import type { VisualizerConnectorRequest } from '../../models/visualizer-connector';

/* Applied when a request is created without a timeout. */
const DEFAULT_REQUEST_TIMEOUT = 10000;

const generateRequestId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

/**
 * A request posted to the iframe, settled by the `${type}/RESPONSE` message
 * carrying the same `requestId`, or rejected with a string once the timeout
 * elapses.
 */
export class DeferredRequest {
  /** Settles with the reply payload, or rejects with a timeout string. */
  readonly promise: Promise<unknown>;

  private readonly requestId = generateRequestId();
  private resolveFn!: (payload: unknown) => void;
  private timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  private replied = false;

  constructor(
    private readonly type: string,
    private readonly payload: unknown,
    timeout: number | undefined,
    libName: string,
  ) {
    const timeoutMs = timeout || DEFAULT_REQUEST_TIMEOUT;
    this.promise = new Promise<unknown>((resolve, reject) => {
      this.resolveFn = resolve;
      this.timeoutHandle = setTimeout(() => {
        reject(`[${libName}] Request ${type} failed. Timeout ${timeoutMs}`);
      }, timeoutMs);
    });
  }

  /** Whether a reply has already settled this request. */
  get isReplied(): boolean {
    return this.replied;
  }

  /** Returns true only for this request's `/RESPONSE` type and id. */
  match(type: string, requestId: string): boolean {
    return `${this.type}/RESPONSE` === type && this.requestId === requestId;
  }

  /** Resolves with `payload` and stops the timeout. No-op after the first reply. */
  reply(payload: unknown): void {
    if (this.replied) {
      return;
    }
    this.replied = true;
    clearTimeout(this.timeoutHandle);
    this.resolveFn(payload);
  }

  /** The message to post to the iframe. */
  toPostMessage(): VisualizerConnectorRequest {
    return {
      type: this.type,
      payload: this.payload,
      requestId: this.requestId,
    };
  }
}

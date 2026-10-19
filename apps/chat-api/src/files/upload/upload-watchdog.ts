export const UPLOAD_CHUNK_BYTES = 64 * 1024;
export const UPLOAD_RESPONSE_TIMEOUT_MS = 120_000;
export const UPLOAD_MAX_DURATION_MS = 1_800_000;

export enum UploadAbortReason {
  Stalled = 'stalled',
  ResponseTimeout = 'response-timeout',
  MaxDuration = 'max-duration',
}

export interface UploadWatchdogLimits {
  /** Max time the transport may go without pulling the next chunk. */
  idleMs: number;
  /** Max time to wait for DIAL Core to answer once the last chunk is handed over. */
  responseMs: number;
  /** Absolute safety ceiling for the whole transfer. */
  maxDurationMs: number;
}

/**
 * Yields the buffer in bounded views (`subarray`, no copy). `Readable.from(buffer)`
 * would emit the whole buffer as a single chunk, leaving nothing to observe.
 */
export function* sliceBuffer(
  buffer: Buffer,
  chunkBytes: number = UPLOAD_CHUNK_BYTES,
): Generator<Buffer> {
  for (let offset = 0; offset < buffer.length; offset += chunkBytes) {
    yield buffer.subarray(offset, offset + chunkBytes);
  }
}

/**
 * Bounds a streamed upload by progress rather than by wall-clock time.
 *
 * The transport only pulls the next chunk when the socket can take more data,
 * so the gap between pulls is a faithful stall signal: a slow but live
 * transfer keeps resetting the idle timer, a dead one trips it. After the last
 * chunk the idle timer is swapped for a response timer, because no more bytes
 * move while DIAL Core finishes writing the file. An absolute ceiling guards
 * against a transfer that keeps trickling forever.
 *
 * `signal` aborts on the first limit hit; `reason` says which one.
 */
export class UploadWatchdog {
  private readonly controller = new AbortController();
  private readonly maxDurationTimer: NodeJS.Timeout;
  private stepTimer: NodeJS.Timeout | undefined;
  private abortReason: UploadAbortReason | undefined;

  constructor(private readonly limits: UploadWatchdogLimits) {
    this.maxDurationTimer = setTimeout(
      () => this.abort(UploadAbortReason.MaxDuration),
      limits.maxDurationMs,
    );
    this.armStepTimer(limits.idleMs, UploadAbortReason.Stalled);
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get reason(): UploadAbortReason | undefined {
    return this.abortReason;
  }

  /** Passes chunks through, restarting the idle timer each time one is requested. */
  async *watch(chunks: Iterable<Buffer>): AsyncGenerator<Buffer> {
    for (const chunk of chunks) {
      this.armStepTimer(this.limits.idleMs, UploadAbortReason.Stalled);
      yield chunk;
    }
    this.armStepTimer(
      this.limits.responseMs,
      UploadAbortReason.ResponseTimeout,
    );
  }

  dispose(): void {
    clearTimeout(this.maxDurationTimer);
    clearTimeout(this.stepTimer);
  }

  private armStepTimer(ms: number, reason: UploadAbortReason): void {
    clearTimeout(this.stepTimer);
    this.stepTimer = setTimeout(() => this.abort(reason), ms);
  }

  private abort(reason: UploadAbortReason): void {
    if (this.abortReason !== undefined) {
      return;
    }
    this.abortReason = reason;
    this.dispose();
    this.controller.abort();
  }
}

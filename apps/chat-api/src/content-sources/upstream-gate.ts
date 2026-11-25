import {
  abortReason,
  UpstreamError,
  UpstreamFailure,
} from './content-provider';
import { ContentSourceQueueOutcome } from './content-sources-telemetry';

export interface UpstreamGateLimits {
  /** Calls that may run at once. */
  readonly concurrency: number;
  /** Calls that may wait for a slot; 0 refuses at once when saturated. */
  readonly queueSize: number;
}

export interface UpstreamGateRunOptions {
  /** How long a call may wait for a slot before it fails as unavailable. */
  readonly waitMs: number;
  /** Aborting it removes a queued call; a running call keeps its slot until it settles. */
  readonly signal?: AbortSignal;
  /** Waits even when the queue is at `queueSize`; the caller bounds its own fan-out. */
  readonly isQueueLimitExempt?: boolean;
  /** Called exactly once per call with how it left the queue and how long it waited. */
  readonly onQueueOutcome?: (
    outcome: ContentSourceQueueOutcome,
    waitSeconds: number,
  ) => void;
}

const secondsSince = (startedAt: number): number =>
  (performance.now() - startedAt) / 1000;

/**
 * A FIFO semaphore for upstream calls of one pool, ported from the
 * conversation-title read gate (`ConversationTitleCacheService.withReadSlot`).
 * A released slot is handed straight to the oldest waiter, so a newly
 * arriving call never overtakes the queue. A waiter that times out or is
 * aborted leaves the queue; an aborted running call keeps its slot until its
 * promise settles, so cancellation never pushes concurrency above the cap.
 */
export class UpstreamGate {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limits: UpstreamGateLimits) {}

  get activeCount(): number {
    return this.active;
  }

  get waitingCount(): number {
    return this.waiting.length;
  }

  async run<T>(
    task: () => Promise<T>,
    options: UpstreamGateRunOptions,
  ): Promise<T> {
    const { signal, onQueueOutcome } = options;
    const queuedAt = performance.now();
    if (signal?.aborted) {
      onQueueOutcome?.(ContentSourceQueueOutcome.Cancelled, 0);
      throw abortReason(signal);
    }

    if (this.active >= this.limits.concurrency) {
      if (
        !options.isQueueLimitExempt &&
        this.waiting.length >= this.limits.queueSize
      ) {
        onQueueOutcome?.(ContentSourceQueueOutcome.QueueFull, 0);
        throw new UpstreamError(
          UpstreamFailure.QueueFull,
          'Upstream queue is full',
        );
      }
      try {
        await this.waitForSlot(options.waitMs, signal);
      } catch (error) {
        onQueueOutcome?.(
          signal?.aborted
            ? ContentSourceQueueOutcome.Cancelled
            : ContentSourceQueueOutcome.TimedOut,
          secondsSince(queuedAt),
        );
        throw error;
      }
    } else {
      this.active++;
    }
    onQueueOutcome?.(
      ContentSourceQueueOutcome.Admitted,
      secondsSince(queuedAt),
    );

    try {
      /* Aborted between the handover and this turn: pass the slot on unused. */
      if (signal?.aborted) throw abortReason(signal);
      return await task();
    } finally {
      const next = this.waiting.shift();
      if (next) next();
      else this.active--;
    }
  }

  /** Resolves once a slot is handed over; rejects on abort or wait timeout. */
  private waitForSlot(waitMs: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const leave = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        const index = this.waiting.indexOf(enter);
        if (index !== -1) this.waiting.splice(index, 1);
      };
      const enter = () => {
        leave();
        resolve();
      };
      const onAbort = () => {
        leave();
        reject(abortReason(signal as AbortSignal));
      };
      const timer = setTimeout(() => {
        leave();
        reject(
          new UpstreamError(
            UpstreamFailure.Unavailable,
            'Timed out waiting for upstream capacity',
          ),
        );
      }, waitMs);
      signal?.addEventListener('abort', onAbort, { once: true });
      this.waiting.push(enter);
    });
  }
}

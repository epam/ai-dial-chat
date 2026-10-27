import { AsyncLocalStorage } from 'node:async_hooks';

export enum RequestTimingPhase {
  Total = 'total',
  Core = 'core',
  Chat = 'chat',
}

export type RequestTimingSnapshot = Record<RequestTimingPhase, number>;

/*
 * Accumulates the union of Core wire intervals in constant space. Concurrent
 * Core calls contribute wall time once, and settlement clips an unfinished
 * call to the HTTP boundary. The remainder is not CPU time: other dependencies,
 * local work and client backpressure can all occupy it.
 */
export class RequestTimingState {
  private readonly startedAt: number;
  private activeCoreCalls = 0;
  private coreStartedAt = 0;
  private coreMilliseconds = 0;
  private snapshot?: RequestTimingSnapshot;

  constructor(private readonly now: () => number = () => performance.now()) {
    this.startedAt = this.now();
  }

  startCoreCall(): () => void {
    if (this.snapshot) return () => undefined;

    if (this.activeCoreCalls++ === 0) this.coreStartedAt = this.now();
    let ended = false;

    return () => {
      if (ended || this.snapshot) return;
      ended = true;
      if (--this.activeCoreCalls === 0) {
        this.coreMilliseconds += this.now() - this.coreStartedAt;
      }
    };
  }

  settle(): RequestTimingSnapshot {
    if (this.snapshot) return this.snapshot;

    const endedAt = this.now();
    const total = Math.max(0, endedAt - this.startedAt) / 1000;
    const core = Math.min(
      total,
      Math.max(
        0,
        this.coreMilliseconds +
          (this.activeCoreCalls > 0 ? endedAt - this.coreStartedAt : 0),
      ) / 1000,
    );
    this.snapshot = {
      [RequestTimingPhase.Total]: total,
      [RequestTimingPhase.Core]: core,
      [RequestTimingPhase.Chat]: total - core,
    };
    return this.snapshot;
  }
}

export const requestTimingStorage = new AsyncLocalStorage<RequestTimingState>();

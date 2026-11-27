import { AsyncLocalStorage } from 'node:async_hooks';

export enum RequestTimingPhase {
  Total = 'total',
  Core = 'core',
  Analytics = 'analytics',
  Chat = 'chat',
}

/** An upstream whose wire time is attributed to its own phase of the same name. */
export enum RequestTimingUpstream {
  Core = 'core',
  Analytics = 'analytics',
}

export type RequestTimingSnapshot = Record<RequestTimingPhase, number>;

interface IntervalUnion {
  active: number;
  startedAt: number;
  milliseconds: number;
}

const createUnion = (): IntervalUnion => ({
  active: 0,
  startedAt: 0,
  milliseconds: 0,
});

/*
 * Accumulates, in constant space, the union of each upstream's wire intervals
 * and the union of all of them. Concurrent calls to one upstream contribute
 * wall time once; time when Core and Analytics overlap counts in both phases
 * but is subtracted from the remainder once. Settlement clips unfinished calls
 * to the HTTP boundary. The remainder is not CPU time: unmarked dependencies,
 * local work and client backpressure can all occupy it.
 */
export class RequestTimingState {
  private readonly startedAt: number;
  private readonly upstreams: Record<RequestTimingUpstream, IntervalUnion> = {
    [RequestTimingUpstream.Core]: createUnion(),
    [RequestTimingUpstream.Analytics]: createUnion(),
  };
  private readonly anyUpstream = createUnion();
  private snapshot?: RequestTimingSnapshot;

  constructor(private readonly now: () => number = () => performance.now()) {
    this.startedAt = this.now();
  }

  startUpstreamCall(upstream: RequestTimingUpstream): () => void {
    if (this.snapshot) return () => undefined;

    const unions = [this.upstreams[upstream], this.anyUpstream];
    const startedAt = this.now();
    for (const union of unions) {
      if (union.active++ === 0) union.startedAt = startedAt;
    }
    let ended = false;

    return () => {
      if (ended || this.snapshot) return;
      ended = true;
      const endedAt = this.now();
      for (const union of unions) {
        if (--union.active === 0) {
          union.milliseconds += endedAt - union.startedAt;
        }
      }
    };
  }

  settle(): RequestTimingSnapshot {
    if (this.snapshot) return this.snapshot;

    const endedAt = this.now();
    const total = Math.max(0, endedAt - this.startedAt) / 1000;
    const seconds = (union: IntervalUnion): number =>
      Math.min(
        total,
        Math.max(
          0,
          union.milliseconds +
            (union.active > 0 ? endedAt - union.startedAt : 0),
        ) / 1000,
      );
    this.snapshot = {
      [RequestTimingPhase.Total]: total,
      [RequestTimingPhase.Core]: seconds(
        this.upstreams[RequestTimingUpstream.Core],
      ),
      [RequestTimingPhase.Analytics]: seconds(
        this.upstreams[RequestTimingUpstream.Analytics],
      ),
      [RequestTimingPhase.Chat]: Math.max(0, total - seconds(this.anyUpstream)),
    };
    return this.snapshot;
  }
}

export const requestTimingStorage = new AsyncLocalStorage<RequestTimingState>();

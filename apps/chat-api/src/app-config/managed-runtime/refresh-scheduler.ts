import { RuntimeReadKind, type RuntimeReadResult } from './snapshot-reader';

/** Time and randomness, injected so refreshes run under a fake clock in tests. */
export interface ManagedRuntimeClock {
  now(): number;
  setTimer(callback: () => void, delayMs: number): unknown;
  clearTimer(handle: unknown): void;
  /** A uniform value in [0, 1), for jitter. */
  random(): number;
}

/** Nest injection token of the `ManagedRuntimeClock`. */
export const MANAGED_RUNTIME_CLOCK = Symbol('MANAGED_RUNTIME_CLOCK');

export const systemManagedRuntimeClock: ManagedRuntimeClock = {
  now: () => Date.now(),
  setTimer: (callback, delayMs) => {
    const handle = setTimeout(callback, delayMs);
    /* A pending refresh never keeps the process alive on shutdown. */
    handle.unref();
    return handle;
  },
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  random: () => Math.random(),
};

/** The jitter added on top of every delay, as a fraction of it. */
export const REFRESH_JITTER = 0.1;
/** The longest backoff, in refresh intervals. */
export const MAX_BACKOFF_INTERVALS = 5;

/**
 * The delay before the next attempt: the interval after a success, and a
 * doubling backoff capped at five intervals after `consecutiveFailures`
 * failures, each stretched by up to 10 % jitter.
 */
export const nextRefreshDelay = (
  intervalMs: number,
  consecutiveFailures: number,
  random: number,
): number => {
  const base =
    consecutiveFailures === 0
      ? intervalMs
      : Math.min(
          intervalMs * 2 ** consecutiveFailures,
          intervalMs * MAX_BACKOFF_INTERVALS,
        );
  return base * (1 + REFRESH_JITTER * random);
};

/** A read result that reached the scheduler: every kind but `aborted`. */
export type AppliedReadResult = Exclude<
  RuntimeReadResult,
  { readonly kind: RuntimeReadKind.Aborted }
>;

/** What one instance's scheduler does on each attempt. */
export interface RefreshHooks {
  /** Reads the snapshot; must honor `signal`. */
  fetch(signal: AbortSignal): Promise<RuntimeReadResult>;
  /**
   * Applies the result of the attempt that is still current; returns whether
   * it succeeded. A throw counts as a failed attempt.
   */
  apply(result: AppliedReadResult, durationMs: number): boolean;
  /** A response arrived after its attempt had already ended. */
  onLateDiscarded(): void;
  /** `apply` threw; the scheduler treated it as a failure and keeps polling. */
  onApplyError(error: unknown): void;
}

/**
 * Runs one instance's refreshes: at most one request in flight, a deadline
 * per attempt, jittered intervals and capped backoff. Attempts never overlap:
 * the next one is scheduled only after the previous one ended, so a response
 * that arrives after its attempt timed out or the scheduler stopped is the
 * only stale result possible, and it is discarded. Nothing an attempt does
 * can stop the polling or escape as an unhandled rejection.
 */
export class InstanceRefreshScheduler {
  private consecutiveFailures = 0;
  private timer: unknown;
  private controller: AbortController | undefined;
  private stopped = false;

  constructor(
    private readonly clock: ManagedRuntimeClock,
    private readonly intervalMs: number,
    private readonly timeoutMs: number,
    private readonly hooks: RefreshHooks,
  ) {}

  /** Runs the first attempt; resolves once it is applied, timed out or stopped. */
  start(): Promise<void> {
    return this.attempt();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer !== undefined) this.clock.clearTimer(this.timer);
    this.timer = undefined;
    this.controller?.abort();
  }

  private async attempt(): Promise<void> {
    if (this.stopped) return;
    this.timer = undefined;
    const controller = new AbortController();
    this.controller = controller;
    const startedAt = this.clock.now();

    const result = await new Promise<RuntimeReadResult>((resolve) => {
      const deadline = this.clock.setTimer(() => {
        controller.abort();
        resolve({ kind: RuntimeReadKind.Unavailable });
      }, this.timeoutMs);
      const settle = (late: RuntimeReadResult) => {
        this.clock.clearTimer(deadline);
        /* After the deadline this resolve is a no-op; after stop() it ends
         * the attempt, so a pending start() always settles. */
        if (
          controller.signal.aborted &&
          !this.stopped &&
          late.kind !== RuntimeReadKind.Aborted
        ) {
          this.hooks.onLateDiscarded();
        }
        resolve(late);
      };
      let fetching: Promise<RuntimeReadResult>;
      try {
        fetching = this.hooks.fetch(controller.signal);
      } catch {
        fetching = Promise.resolve({ kind: RuntimeReadKind.Unavailable });
      }
      fetching.then(settle, () =>
        settle({ kind: RuntimeReadKind.Unavailable }),
      );
    });

    if (this.stopped || result.kind === RuntimeReadKind.Aborted) return;
    let succeeded = false;
    try {
      succeeded = this.hooks.apply(result, this.clock.now() - startedAt);
    } catch (error) {
      this.hooks.onApplyError(error);
    }
    this.consecutiveFailures = succeeded ? 0 : this.consecutiveFailures + 1;
    this.timer = this.clock.setTimer(
      () => void this.attempt(),
      nextRefreshDelay(
        this.intervalMs,
        this.consecutiveFailures,
        this.clock.random(),
      ),
    );
  }
}

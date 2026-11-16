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

/** What one instance's scheduler does on each attempt. */
export interface RefreshHooks {
  /** Reads the snapshot; must honor `signal`. */
  fetch(signal: AbortSignal): Promise<RuntimeReadResult>;
  /** Applies the result of the current generation; returns whether it succeeded. */
  apply(result: RuntimeReadResult, durationMs: number): boolean;
  /** A response arrived for a generation that is no longer current. */
  onLateDiscarded(): void;
}

/**
 * Runs one instance's refreshes: at most one request in flight, a deadline
 * per attempt, jittered intervals and capped backoff. Every attempt has a
 * generation; a response that arrives after its attempt timed out, was
 * superseded or the scheduler stopped is discarded.
 */
export class InstanceRefreshScheduler {
  private generation = 0;
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

  /** Runs the first attempt; resolves once it is applied or timed out. */
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
    const generation = ++this.generation;
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
        if (controller.signal.aborted) {
          /* The attempt already ended; only a real response counts as late. */
          if (!this.stopped && late.kind !== RuntimeReadKind.Aborted) {
            this.hooks.onLateDiscarded();
          }
          return;
        }
        resolve(late);
      };
      this.hooks
        .fetch(controller.signal)
        .then(settle, () => settle({ kind: RuntimeReadKind.Unavailable }));
    });

    if (this.stopped || generation !== this.generation) return;
    const succeeded = this.hooks.apply(result, this.clock.now() - startedAt);
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

import { describe, expect, it, vi } from 'vitest';
import {
  InstanceRefreshScheduler,
  nextRefreshDelay,
  type RefreshHooks,
} from '../../managed-runtime/refresh-scheduler';
import {
  RuntimeReadKind,
  type RuntimeReadResult,
} from '../../managed-runtime/snapshot-reader';
import { createFakeClock } from './managed-runtime.fixtures';

const INTERVAL = 60_000;
const TIMEOUT = 5_000;

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
};

describe('nextRefreshDelay', () => {
  it('waits one interval after a success, plus up to 10 % jitter', () => {
    expect(nextRefreshDelay(INTERVAL, 0, 0)).toBe(60_000);
    expect(nextRefreshDelay(INTERVAL, 0, 0.999)).toBeLessThan(66_000);
  });

  it('doubles after each failure and caps at five intervals', () => {
    expect([1, 2, 3, 4].map((n) => nextRefreshDelay(INTERVAL, n, 0))).toEqual([
      120_000, 240_000, 300_000, 300_000,
    ]);
    expect(nextRefreshDelay(INTERVAL, 4, 0.999)).toBeLessThan(330_000);
  });
});

describe('InstanceRefreshScheduler', () => {
  const makeScheduler = (
    fetch: RefreshHooks['fetch'],
    apply: RefreshHooks['apply'] = () => true,
  ) => {
    const clock = createFakeClock();
    const hooks = {
      fetch: vi.fn(fetch),
      apply: vi.fn(apply),
      onLateDiscarded: vi.fn(),
    };
    const scheduler = new InstanceRefreshScheduler(
      clock,
      INTERVAL,
      TIMEOUT,
      hooks,
    );
    return { clock, hooks, scheduler };
  };

  it('backs off after failures and resets after a success', async () => {
    let failing = true;
    const { clock, hooks, scheduler } = makeScheduler(
      async () => ({ kind: RuntimeReadKind.Unavailable }),
      () => !failing,
    );
    await scheduler.start();
    expect(clock.pendingDelays()).toEqual([120_000]);

    await clock.advance(120_000);
    expect(clock.pendingDelays()).toEqual([240_000]);
    await clock.advance(240_000);
    expect(clock.pendingDelays()).toEqual([300_000]);
    await clock.advance(300_000);
    expect(clock.pendingDelays()).toEqual([300_000]);

    failing = false;
    await clock.advance(300_000);
    expect(clock.pendingDelays()).toEqual([60_000]);
    expect(hooks.fetch).toHaveBeenCalledTimes(5);
  });

  it('keeps at most one request in flight', async () => {
    const { clock, hooks, scheduler } = makeScheduler(
      () => new Promise<RuntimeReadResult>(() => undefined),
    );
    const started = scheduler.start();
    await clock.advance(4_999);
    expect(hooks.fetch).toHaveBeenCalledTimes(1);
    await clock.advance(1);
    await started;
    expect(hooks.apply).toHaveBeenCalledWith(
      { kind: RuntimeReadKind.Unavailable },
      TIMEOUT,
    );
  });

  it('discards a response that arrives after its attempt timed out', async () => {
    const late = deferred<RuntimeReadResult>();
    const responses = [
      late.promise,
      Promise.resolve<RuntimeReadResult>({
        kind: RuntimeReadKind.Candidate,
        body: { revisionId: 'r2' },
      }),
    ];
    const { clock, hooks, scheduler } = makeScheduler(
      () => responses.shift() ?? new Promise(() => undefined),
    );

    const started = scheduler.start();
    await clock.advance(TIMEOUT);
    await started;
    await clock.advance(120_000);
    expect(hooks.apply).toHaveBeenLastCalledWith(
      { kind: RuntimeReadKind.Candidate, body: { revisionId: 'r2' } },
      0,
    );

    late.resolve({
      kind: RuntimeReadKind.Candidate,
      body: { revisionId: 'r1' },
    });
    await clock.advance(0);

    expect(hooks.apply).toHaveBeenCalledTimes(2);
    expect(hooks.onLateDiscarded).toHaveBeenCalledTimes(1);
  });

  it('stops scheduling and aborts the request in flight', async () => {
    let signal: AbortSignal | undefined;
    const { clock, hooks, scheduler } = makeScheduler((abortSignal) => {
      signal = abortSignal;
      return new Promise(() => undefined);
    });
    void scheduler.start();
    scheduler.stop();
    expect(signal?.aborted).toBe(true);
    await clock.advance(600_000);
    expect(hooks.fetch).toHaveBeenCalledTimes(1);
    expect(hooks.apply).not.toHaveBeenCalled();
  });
});

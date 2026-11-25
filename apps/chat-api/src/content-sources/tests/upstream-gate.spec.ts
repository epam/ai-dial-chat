import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpstreamError, UpstreamFailure } from '../content-provider';
import { ContentSourceQueueOutcome } from '../content-sources-telemetry';
import { UpstreamGate } from '../upstream-gate';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

const deferred = <T = string>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

/** Lets pending promise continuations run. */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const WAIT_MS = 1000;

describe('UpstreamGate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never runs more tasks at once than its concurrency', async () => {
    const gate = new UpstreamGate({ concurrency: 3, queueSize: 100 });
    let running = 0;
    let peak = 0;
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        gate.run(
          async () => {
            running++;
            peak = Math.max(peak, running);
            await new Promise((resolve) => setTimeout(resolve, 1));
            running--;
            return index;
          },
          { waitMs: WAIT_MS },
        ),
      ),
    );
    expect(peak).toBe(3);
    expect(results).toEqual(Array.from({ length: 20 }, (_, index) => index));
    expect(gate.activeCount).toBe(0);
    expect(gate.waitingCount).toBe(0);
  });

  it('starts queued tasks in arrival order, before newly arriving ones', async () => {
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 10 });
    const order: string[] = [];
    const first = deferred();
    const running = gate.run(() => first.promise, { waitMs: WAIT_MS });
    const queued = ['a', 'b', 'c'].map((name) =>
      gate.run(
        async () => {
          order.push(name);
          return name;
        },
        { waitMs: WAIT_MS },
      ),
    );
    expect(gate.waitingCount).toBe(3);

    first.resolve('first');
    await running;
    /* Arrives after the release but must not overtake the queue. */
    const late = gate.run(
      async () => {
        order.push('late');
        return 'late';
      },
      { waitMs: WAIT_MS },
    );
    await Promise.all([...queued, late]);
    expect(order).toEqual(['a', 'b', 'c', 'late']);
  });

  it('refuses a call without running it when the queue is full', async () => {
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 1 });
    const hold = deferred();
    const outcomes: ContentSourceQueueOutcome[] = [];
    const onQueueOutcome = (outcome: ContentSourceQueueOutcome) =>
      outcomes.push(outcome);
    const running = gate.run(() => hold.promise, {
      waitMs: WAIT_MS,
      onQueueOutcome,
    });
    const queued = gate.run(() => Promise.resolve('queued'), {
      waitMs: WAIT_MS,
      onQueueOutcome,
    });
    const task = vi.fn().mockResolvedValue('never');

    const refused = gate.run(task, { waitMs: WAIT_MS, onQueueOutcome });
    await expect(refused).rejects.toBeInstanceOf(UpstreamError);
    await refused.catch((error: UpstreamError) =>
      expect(error.failure).toBe(UpstreamFailure.QueueFull),
    );
    expect(task).not.toHaveBeenCalled();

    hold.resolve('done');
    await expect(Promise.all([running, queued])).resolves.toEqual([
      'done',
      'queued',
    ]);
    expect(outcomes).toEqual([
      ContentSourceQueueOutcome.Admitted,
      ContentSourceQueueOutcome.QueueFull,
      ContentSourceQueueOutcome.Admitted,
    ]);
  });

  it('queues an exempt call past the queue size, still in arrival order', async () => {
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 0 });
    const hold = deferred();
    const running = gate.run(() => hold.promise, { waitMs: WAIT_MS });
    await expect(
      gate.run(() => Promise.resolve('refused'), { waitMs: WAIT_MS }),
    ).rejects.toMatchObject({ failure: UpstreamFailure.QueueFull });

    const exempt = gate.run(() => Promise.resolve('exempt'), {
      waitMs: WAIT_MS,
      isQueueLimitExempt: true,
    });
    expect(gate.waitingCount).toBe(1);
    hold.resolve('done');
    await expect(Promise.all([running, exempt])).resolves.toEqual([
      'done',
      'exempt',
    ]);
  });

  it('refuses at once when the queue size is 0 and every slot is taken', async () => {
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 0 });
    const hold = deferred();
    const running = gate.run(() => hold.promise, { waitMs: WAIT_MS });
    await expect(
      gate.run(() => Promise.resolve('x'), { waitMs: WAIT_MS }),
    ).rejects.toMatchObject({ failure: UpstreamFailure.QueueFull });
    hold.resolve('done');
    await running;
    await expect(
      gate.run(() => Promise.resolve('free'), { waitMs: WAIT_MS }),
    ).resolves.toBe('free');
  });

  it('fails a wait past the deadline as unavailable and frees its queue position', async () => {
    vi.useFakeTimers();
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 1 });
    const hold = deferred();
    const onQueueOutcome = vi.fn();
    const running = gate.run(() => hold.promise, { waitMs: WAIT_MS });
    const task = vi.fn().mockResolvedValue('never');
    const waiting = gate.run(task, { waitMs: WAIT_MS, onQueueOutcome });
    const assertion = expect(waiting).rejects.toMatchObject({
      failure: UpstreamFailure.Unavailable,
    });

    await vi.advanceTimersByTimeAsync(WAIT_MS);
    await assertion;
    expect(task).not.toHaveBeenCalled();
    expect(gate.waitingCount).toBe(0);
    expect(onQueueOutcome).toHaveBeenCalledWith(
      ContentSourceQueueOutcome.TimedOut,
      expect.any(Number),
    );

    /* The freed position accepts a new waiter. */
    const next = gate.run(() => Promise.resolve('next'), { waitMs: WAIT_MS });
    expect(gate.waitingCount).toBe(1);
    hold.resolve('done');
    await running;
    await expect(next).resolves.toBe('next');
  });

  it('removes an aborted waiter from the queue without running it', async () => {
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 5 });
    const hold = deferred();
    const running = gate.run(() => hold.promise, { waitMs: WAIT_MS });
    const controller = new AbortController();
    const onQueueOutcome = vi.fn();
    const task = vi.fn().mockResolvedValue('never');
    const waiting = gate.run(task, {
      waitMs: WAIT_MS,
      signal: controller.signal,
      onQueueOutcome,
    });
    expect(gate.waitingCount).toBe(1);

    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    expect(gate.waitingCount).toBe(0);
    expect(onQueueOutcome).toHaveBeenCalledWith(
      ContentSourceQueueOutcome.Cancelled,
      expect.any(Number),
    );

    hold.resolve('done');
    await running;
    expect(task).not.toHaveBeenCalled();
    expect(gate.activeCount).toBe(0);
  });

  it('keeps an aborted running task in its slot until it settles', async () => {
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 5 });
    const controller = new AbortController();
    const hold = deferred();
    const running = gate.run(() => hold.promise, {
      waitMs: WAIT_MS,
      signal: controller.signal,
    });
    const nextTask = vi.fn().mockResolvedValue('next');
    const next = gate.run(nextTask, { waitMs: WAIT_MS });

    controller.abort();
    await flush();
    expect(gate.activeCount).toBe(1);
    expect(nextTask).not.toHaveBeenCalled();

    hold.reject(new Error('aborted fetch'));
    await expect(running).rejects.toThrow('aborted fetch');
    await expect(next).resolves.toBe('next');
    expect(gate.activeCount).toBe(0);
  });

  it.each([
    ['success', () => Promise.resolve('ok')],
    [
      'an upstream error',
      () =>
        Promise.reject(
          new UpstreamError(UpstreamFailure.BadResponse, 'Upstream failed'),
        ),
    ],
    [
      'a call timeout',
      () =>
        Promise.reject(
          new UpstreamError(UpstreamFailure.Unavailable, 'timed out'),
        ),
    ],
  ])('releases the slot after %s', async (_, task) => {
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 0 });
    await gate.run(task, { waitMs: WAIT_MS }).catch(() => undefined);
    expect(gate.activeCount).toBe(0);
    await expect(
      gate.run(() => Promise.resolve('after'), { waitMs: WAIT_MS }),
    ).resolves.toBe('after');
  });

  it('reports one admitted outcome per started call with its wait', async () => {
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 5 });
    const hold = deferred();
    const samples: [ContentSourceQueueOutcome, number][] = [];
    const onQueueOutcome = (outcome: ContentSourceQueueOutcome, s: number) =>
      samples.push([outcome, s]);
    const running = gate.run(() => hold.promise, {
      waitMs: WAIT_MS,
      onQueueOutcome,
    });
    const queued = gate.run(() => Promise.resolve('q'), {
      waitMs: WAIT_MS,
      onQueueOutcome,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    hold.resolve('done');
    await Promise.all([running, queued]);

    expect(samples.map(([outcome]) => outcome)).toEqual([
      ContentSourceQueueOutcome.Admitted,
      ContentSourceQueueOutcome.Admitted,
    ]);
    expect(samples[0][1]).toBeLessThan(0.01);
    expect(samples[1][1]).toBeGreaterThanOrEqual(0.015);
  });

  it('refuses an already aborted call without queueing it', async () => {
    const gate = new UpstreamGate({ concurrency: 1, queueSize: 5 });
    const task = vi.fn();
    await expect(
      gate.run(task, { waitMs: WAIT_MS, signal: AbortSignal.abort() }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(task).not.toHaveBeenCalled();
    expect(gate.activeCount).toBe(0);
  });
});

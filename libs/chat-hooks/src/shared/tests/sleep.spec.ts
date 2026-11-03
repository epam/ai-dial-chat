import { afterEach, describe, expect, it, vi } from 'vitest';
import { sleep } from '../sleep';

describe('sleep', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves after the delay', async () => {
    vi.useFakeTimers();
    const done = vi.fn();

    void sleep(1_000, new AbortController().signal).then(done);
    await vi.advanceTimersByTimeAsync(999);
    expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(done).toHaveBeenCalledOnce();
  });

  it('resolves at once and sets no timer when the signal is already aborted', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort();

    await sleep(60_000, controller.signal);

    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves as soon as the signal aborts and clears the timer', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const done = vi.fn();

    void sleep(60_000, controller.signal).then(done);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(done).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});

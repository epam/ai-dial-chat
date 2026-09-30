import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFrameScheduler } from '../frame-scheduler';

describe('createFrameScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('runs only the latest task for a key, once, on the next frame', () => {
    const scheduler = createFrameScheduler();
    const first = vi.fn();
    const second = vi.fn();

    scheduler.schedule('path', first);
    scheduler.schedule('path', second);
    expect(second).not.toHaveBeenCalled();

    vi.advanceTimersToNextFrame();
    vi.advanceTimersToNextFrame();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it('keeps tasks for different keys apart', () => {
    const scheduler = createFrameScheduler();
    const onA = vi.fn();
    const onB = vi.fn();

    scheduler.schedule('a', onA);
    scheduler.schedule('b', onB);
    vi.advanceTimersToNextFrame();

    expect(onA).toHaveBeenCalledOnce();
    expect(onB).toHaveBeenCalledOnce();
  });

  it('runs a pending task synchronously on flush and not again on the frame', () => {
    const scheduler = createFrameScheduler();
    const task = vi.fn();

    scheduler.schedule('path', task);
    scheduler.flush('path');
    expect(task).toHaveBeenCalledOnce();

    vi.advanceTimersToNextFrame();
    expect(task).toHaveBeenCalledOnce();
  });

  it('does nothing on flush when no task is pending', () => {
    const scheduler = createFrameScheduler();

    expect(() => scheduler.flush('path')).not.toThrow();
  });

  it('drops a cancelled task and every task on cancelAll', () => {
    const scheduler = createFrameScheduler();
    const cancelled = vi.fn();
    const onA = vi.fn();
    const onB = vi.fn();

    scheduler.schedule('path', cancelled);
    scheduler.cancel('path');
    scheduler.schedule('a', onA);
    scheduler.schedule('b', onB);
    scheduler.cancelAll();
    vi.advanceTimersToNextFrame();

    expect(cancelled).not.toHaveBeenCalled();
    expect(onA).not.toHaveBeenCalled();
    expect(onB).not.toHaveBeenCalled();
  });

  it('falls back to a timer when requestAnimationFrame is unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const scheduler = createFrameScheduler();
    const task = vi.fn();

    scheduler.schedule('path', task);
    vi.advanceTimersByTime(16);

    expect(task).toHaveBeenCalledOnce();
  });
});

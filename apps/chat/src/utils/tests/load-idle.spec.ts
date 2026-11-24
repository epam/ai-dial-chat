import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isAfterLoadIdle,
  resetAfterLoadIdleForTests,
  scheduleAfterLoadIdle,
} from '../load-idle';

const setReadyState = (state: DocumentReadyState) => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => state,
  });
};

describe('load-idle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAfterLoadIdleForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setReadyState('complete');
  });

  it('waits for the load event while the document is still loading', () => {
    setReadyState('loading');
    const callback = vi.fn();

    scheduleAfterLoadIdle(callback);
    vi.runAllTimers();
    expect(callback).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    vi.runAllTimers();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(isAfterLoadIdle()).toBe(true);
  });

  it('runs at the next idle period when the document has already loaded', () => {
    setReadyState('complete');
    let idleCallback: () => void = () => undefined;
    const requestIdleCallback = vi.fn((callback: () => void) => {
      idleCallback = callback;
      return 1;
    });
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    const callback = vi.fn();

    scheduleAfterLoadIdle(callback);
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 2000,
    });
    expect(callback).not.toHaveBeenCalled();

    idleCallback();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timeout where requestIdleCallback is unavailable', () => {
    setReadyState('complete');
    vi.stubGlobal('requestIdleCallback', undefined);
    const callback = vi.fn();

    scheduleAfterLoadIdle(callback);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1999);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('runs straight away once the idle point has been reached', () => {
    setReadyState('complete');
    scheduleAfterLoadIdle(vi.fn());
    vi.runAllTimers();
    const callback = vi.fn();

    scheduleAfterLoadIdle(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('never runs a cancelled callback', () => {
    setReadyState('loading');
    const callback = vi.fn();

    const cancel = scheduleAfterLoadIdle(callback);
    cancel();
    window.dispatchEvent(new Event('load'));
    vi.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
  });

  it('serves every pending callback from one load listener and one idle callback', () => {
    setReadyState('loading');
    const addEventListener = vi.spyOn(window, 'addEventListener');
    let idleCallback: () => void = () => undefined;
    const requestIdleCallback = vi.fn((callback: () => void) => {
      idleCallback = callback;
      return 1;
    });
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    const first = vi.fn();
    const second = vi.fn();

    scheduleAfterLoadIdle(first);
    scheduleAfterLoadIdle(second);
    window.dispatchEvent(new Event('load'));
    idleCallback();

    expect(
      addEventListener.mock.calls.filter(([type]) => type === 'load'),
    ).toHaveLength(1);
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    addEventListener.mockRestore();
  });

  it('keeps the other callbacks when one of them is cancelled', () => {
    setReadyState('loading');
    const cancelled = vi.fn();
    const kept = vi.fn();

    const cancel = scheduleAfterLoadIdle(cancelled);
    scheduleAfterLoadIdle(kept);
    cancel();
    window.dispatchEvent(new Event('load'));
    vi.runAllTimers();

    expect(cancelled).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it('cancels the idle callback once the last pending callback is cancelled', () => {
    setReadyState('complete');
    const requestIdleCallback = vi.fn(() => 7);
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal('requestIdleCallback', requestIdleCallback);
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

    const cancelFirst = scheduleAfterLoadIdle(vi.fn());
    const cancelSecond = scheduleAfterLoadIdle(vi.fn());
    cancelFirst();
    expect(cancelIdleCallback).not.toHaveBeenCalled();

    cancelSecond();
    expect(cancelIdleCallback).toHaveBeenCalledWith(7);
    expect(isAfterLoadIdle()).toBe(false);
  });
});

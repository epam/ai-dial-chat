import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isAfterLoadIdle,
  markFirstScreenRendered,
  resetAfterLoadIdleForTests,
  scheduleAfterLoadIdle,
} from '../load-idle';

const setReadyState = (state: DocumentReadyState) => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => state,
  });
};

const stubIdleCallback = () => {
  let idleCallback: () => void = () => undefined;
  const requestIdleCallback = vi.fn((callback: () => void) => {
    idleCallback = callback;
    return 1;
  });
  vi.stubGlobal('requestIdleCallback', requestIdleCallback);
  vi.stubGlobal('cancelIdleCallback', vi.fn());
  return { requestIdleCallback, runIdle: () => idleCallback() };
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
    markFirstScreenRendered();
    const callback = vi.fn();

    scheduleAfterLoadIdle(callback);
    vi.runAllTimers();
    expect(callback).not.toHaveBeenCalled();

    window.dispatchEvent(new Event('load'));
    vi.runAllTimers();
    expect(callback).toHaveBeenCalledTimes(1);
    expect(isAfterLoadIdle()).toBe(true);
  });

  it('waits for the first screen after load, then runs at the next idle period', () => {
    setReadyState('complete');
    const { requestIdleCallback, runIdle } = stubIdleCallback();
    const callback = vi.fn();

    scheduleAfterLoadIdle(callback);
    expect(requestIdleCallback).not.toHaveBeenCalled();

    markFirstScreenRendered();
    expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 2000,
    });
    expect(callback).not.toHaveBeenCalled();

    runIdle();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for a first screen 3 s after load', () => {
    setReadyState('complete');
    const { requestIdleCallback } = stubIdleCallback();

    scheduleAfterLoadIdle(vi.fn());
    vi.advanceTimersByTime(2999);
    expect(requestIdleCallback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(requestIdleCallback).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timeout where requestIdleCallback is unavailable', () => {
    setReadyState('complete');
    markFirstScreenRendered();
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
    markFirstScreenRendered();
    vi.runAllTimers();

    expect(callback).not.toHaveBeenCalled();
  });

  it('serves every pending callback from one load listener and one idle callback', () => {
    setReadyState('loading');
    markFirstScreenRendered();
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
    markFirstScreenRendered();
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

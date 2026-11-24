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
});

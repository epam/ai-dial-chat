import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClientConfigRefresh } from '../useClientConfigRefresh';

const NOW = Date.UTC(2026, 10, 20, 10);

let visibility: DocumentVisibilityState = 'visible';

const setVisibility = (next: DocumentVisibilityState) => {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
};

const inSeconds = (seconds: number) =>
  new Date(Date.now() + seconds * 1000).toISOString();

describe('useClientConfigRefresh', () => {
  let lastLoadStartedAt: number;
  const refresh = vi.fn(() => {
    lastLoadStartedAt = Date.now();
  });

  const render = (nextRefreshAt: string | null) =>
    renderHook(
      ({ hint }: { hint: string | null }) =>
        useClientConfigRefresh({
          nextRefreshAt: hint,
          refresh,
          getLastLoadStartedAt: () => lastLoadStartedAt,
        }),
      { initialProps: { hint: nextRefreshAt } },
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    refresh.mockClear();
    lastLoadStartedAt = NOW;
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(
      () => visibility,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('refreshes once at the hinted time while the tab stays visible', () => {
    render(inSeconds(120));

    vi.advanceTimersByTime(119_999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never refreshes sooner than 15 seconds and waits at most 15 minutes', () => {
    const { rerender } = render(inSeconds(1));
    vi.advanceTimersByTime(14_999);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    rerender({ hint: inSeconds(3_600) });
    vi.advanceTimersByTime(15 * 60_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('schedules nothing while hidden and refreshes on return', () => {
    render(inSeconds(120));
    vi.advanceTimersByTime(20_000);
    setVisibility('hidden');

    vi.advanceTimersByTime(600_000);
    expect(refresh).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes on focus, resume and reconnect after the coalescing gap', () => {
    render(inSeconds(600));
    vi.advanceTimersByTime(15_000);

    window.dispatchEvent(new Event('focus'));
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(15_000);
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    );
    expect(refresh).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(15_000);
    window.dispatchEvent(new Event('online'));
    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('ignores a page show that is not a resume', () => {
    render(inSeconds(600));
    vi.advanceTimersByTime(15_000);
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: false }),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('coalesces a burst of triggers into one request', () => {
    render(inSeconds(600));
    vi.advanceTimersByTime(20_000);

    setVisibility('visible');
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('defers a timed refresh that a recent load already covered', () => {
    render(inSeconds(120));
    vi.advanceTimersByTime(110_000);
    window.dispatchEvent(new Event('focus'));
    expect(refresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5_000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a hint', () => {
    render(null);
    vi.advanceTimersByTime(3_600_000);
    setVisibility('hidden');
    setVisibility('visible');
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('stops listening when unmounted', () => {
    const { unmount } = render(inSeconds(120));
    unmount();
    vi.advanceTimersByTime(600_000);
    window.dispatchEvent(new Event('focus'));
    expect(refresh).not.toHaveBeenCalled();
  });
});

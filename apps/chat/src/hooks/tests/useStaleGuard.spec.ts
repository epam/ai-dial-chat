import { renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';
import { useStaleGuard } from '../useStaleGuard';

describe('useStaleGuard', () => {
  it('reports a begun check as current while the component stays mounted', () => {
    const { result } = renderHook(() => useStaleGuard('sched_123'));

    const checker = result.current();

    expect(checker()).toBe(false);
  });

  it('goes stale once the component unmounts', () => {
    const { result, unmount } = renderHook(() => useStaleGuard('sched_123'));

    const checker = result.current();
    unmount();

    expect(checker()).toBe(true);
  });

  it('supersedes an older check when a newer one begins', () => {
    const { result } = renderHook(() => useStaleGuard('sched_123'));

    const older = result.current();
    const newer = result.current();

    expect(older()).toBe(true);
    expect(newer()).toBe(false);
  });

  it('supersedes checks begun for a previous key', () => {
    const { result, rerender } = renderHook(({ key }) => useStaleGuard(key), {
      initialProps: { key: 'sched_123' },
    });

    const forOldKey = result.current();
    rerender({ key: 'sched_456' });

    expect(forOldKey()).toBe(true);

    const forNewKey = result.current();
    expect(forNewKey()).toBe(false);
  });

  it('stays current under StrictMode’s simulated remount', () => {
    /*
     * Regression: a cleanup-only mount effect leaves the guard stale for the
     * component's whole life under StrictMode, because the double-invoked
     * cleanup runs before the second mount with nothing restoring the flag —
     * every async resolution then resolved as stale.
     */
    const { result } = renderHook(() => useStaleGuard('sched_123'), {
      wrapper: StrictMode,
    });

    const checker = result.current();

    expect(checker()).toBe(false);
  });
});

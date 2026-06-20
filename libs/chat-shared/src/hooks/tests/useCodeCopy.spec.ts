import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCodeCopy } from '../../../../chat-shared/src/hooks/useCodeCopy';
import { copyToClipboard } from '../../utils/copy-to-clipboard';

describe('useCodeCopy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(copyToClipboard).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sets isCopied to true after copy()', async () => {
    const { result } = renderHook(() => useCodeCopy('hello'));

    await act(async () => {
      result.current.copy();
      await Promise.resolve();
    });

    expect(result.current.isCopied).toBe(true);
  });

  it('resets isCopied to false after resetDelay', async () => {
    const { result } = renderHook(() => useCodeCopy('hello', 1000));

    await act(async () => {
      result.current.copy();
      await Promise.resolve();
    });

    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isCopied).toBe(false);
  });

  it('calls copyToClipboard with the correct value', async () => {
    const { result } = renderHook(() => useCodeCopy('test code'));

    await act(async () => {
      result.current.copy();
      await Promise.resolve();
    });

    expect(copyToClipboard).toHaveBeenCalledWith('test code');
  });

  it('clears the timeout on unmount', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useCodeCopy('hello'));

    await act(async () => {
      result.current.copy();
      await Promise.resolve();
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

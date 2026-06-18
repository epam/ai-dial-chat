import { copyToClipboard } from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@epam/ai-dial-chat-shared', () => ({
  copyToClipboard: vi.fn(),
}));
import { useCodeCopy } from '../useCodeCopy';

describe('useCodeCopy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('sets isCopied to true after copy()', () => {
    const { result } = renderHook(() => useCodeCopy('hello'));

    act(() => {
      result.current.copy();
    });

    expect(result.current.isCopied).toBe(true);
  });

  it('resets isCopied to false after resetDelay', () => {
    const { result } = renderHook(() => useCodeCopy('hello', 1000));

    act(() => {
      result.current.copy();
    });

    expect(result.current.isCopied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.isCopied).toBe(false);
  });

  it('calls copyToClipboard with the correct value', () => {
    const { result } = renderHook(() => useCodeCopy('test code'));

    act(() => {
      result.current.copy();
    });

    expect(copyToClipboard).toHaveBeenCalledWith('test code');
  });

  it('clears the timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { result, unmount } = renderHook(() => useCodeCopy('hello'));

    act(() => {
      result.current.copy();
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});

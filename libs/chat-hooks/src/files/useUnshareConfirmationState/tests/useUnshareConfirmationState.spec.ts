import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUnshareConfirmationState } from '../useUnshareConfirmationState';

const files = [{ id: 'f1', name: 'report.pdf' }] as DialFile[];

describe('useUnshareConfirmationState', () => {
  it('holds back the unshare until it is confirmed', () => {
    const onUnshareFiles = vi.fn();
    const { result } = renderHook(() =>
      useUnshareConfirmationState({ onUnshareFiles, extra: 1 }),
    );

    act(() => result.current.controller.onUnshareFiles(files));

    expect(onUnshareFiles).not.toHaveBeenCalled();
    expect(result.current.pendingItems).toBe(files);
    expect(result.current.controller.extra).toBe(1);

    act(() => result.current.confirm());

    expect(onUnshareFiles).toHaveBeenCalledWith(files);
    expect(result.current.pendingItems).toBeNull();
  });

  it('drops the pending items on cancel', () => {
    const onUnshareFiles = vi.fn();
    const { result } = renderHook(() =>
      useUnshareConfirmationState({ onUnshareFiles }),
    );

    act(() => result.current.controller.onUnshareFiles(files));
    act(() => result.current.cancel());

    expect(onUnshareFiles).not.toHaveBeenCalled();
    expect(result.current.pendingItems).toBeNull();
  });
});

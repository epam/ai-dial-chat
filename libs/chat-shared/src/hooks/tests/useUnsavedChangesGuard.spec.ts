import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard';

describe('useUnsavedChangesGuard', () => {
  it('runs the action immediately when nothing is dirty', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(false));

    act(() => result.current.guard(action));

    expect(action).toHaveBeenCalledOnce();
    expect(result.current.isConfirmOpen).toBe(false);
  });

  it('defers the action behind the confirmation when dirty', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    act(() => result.current.guard(action));

    expect(action).not.toHaveBeenCalled();
    expect(result.current.isConfirmOpen).toBe(true);
  });

  it('runs the deferred action once on confirm', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    act(() => result.current.guard(action));
    act(() => result.current.confirm());
    act(() => result.current.confirm());

    expect(action).toHaveBeenCalledOnce();
    expect(result.current.isConfirmOpen).toBe(false);
  });

  it('drops the deferred action on dismiss', () => {
    const action = vi.fn();
    const { result } = renderHook(() => useUnsavedChangesGuard(true));

    act(() => result.current.guard(action));
    act(() => result.current.dismiss());
    act(() => result.current.confirm());

    expect(action).not.toHaveBeenCalled();
    expect(result.current.isConfirmOpen).toBe(false);
  });

  it('asks the browser to warn on unload only while dirty', () => {
    const { rerender } = renderHook(
      ({ isDirty }) => useUnsavedChangesGuard(isDirty),
      { initialProps: { isDirty: true } },
    );

    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    rerender({ isDirty: false });

    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
  });
});

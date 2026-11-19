import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useComposerInterrupts } from '../useComposerInterrupts';

describe('useComposerInterrupts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    'pointerdown',
    'click',
    'keydown',
    'focusin',
    'focusout',
    'beforeinput',
    'input',
    'compositionstart',
    'scroll',
    'resize',
  ])('cancels on a window %s', (name) => {
    const cancel = vi.fn();
    renderHook(() => useComposerInterrupts(true, cancel));
    act(() => {
      window.dispatchEvent(new Event(name));
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('cancels when the tab is hidden, but not when it becomes visible', () => {
    const cancel = vi.fn();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    renderHook(() => useComposerInterrupts(true, cancel));
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });
    expect(cancel).not.toHaveBeenCalled();
    hidden.mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('listens to nothing while inactive', () => {
    const cancel = vi.fn();
    renderHook(() => useComposerInterrupts(false, cancel));
    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });
    expect(cancel).not.toHaveBeenCalled();
  });

  it('removes its listeners on unmount', () => {
    const cancel = vi.fn();
    const { unmount } = renderHook(() => useComposerInterrupts(true, cancel));
    unmount();
    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });
    expect(cancel).not.toHaveBeenCalled();
  });
});

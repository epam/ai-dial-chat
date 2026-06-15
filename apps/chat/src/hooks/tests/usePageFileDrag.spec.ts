import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePageFileDrag } from '../usePageFileDrag';

const makeDragEvent = (
  type: string,
  dataTypes: string[],
  files: File[] = [],
): DragEvent => {
  const event = new Event(type, { bubbles: true }) as DragEvent;
  const fileList = Object.assign([...files], {
    item: (i: number) => files[i],
    length: files.length,
  });
  Object.defineProperty(event, 'dataTransfer', {
    value: { types: dataTypes, files: fileList },
  });
  return event;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('usePageFileDrag', () => {
  it('isDragging becomes true on dragenter with Files type', () => {
    const { result } = renderHook(() => usePageFileDrag());
    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter', ['Files']));
    });
    expect(result.current.isDragging).toBe(true);
  });

  it('isDragging remains false for non-file drag types', () => {
    const { result } = renderHook(() => usePageFileDrag());
    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter', ['text/plain']));
    });
    expect(result.current.isDragging).toBe(false);
  });

  it('isDragging returns to false after dragleave resets counter', () => {
    const { result } = renderHook(() => usePageFileDrag());

    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter', ['Files']));
    });
    expect(result.current.isDragging).toBe(true);

    act(() => {
      document.dispatchEvent(makeDragEvent('dragleave', ['Files']));
    });
    expect(result.current.isDragging).toBe(false);
  });

  it('isDragging stays true while counter > 0 (multiple dragenter)', () => {
    const { result } = renderHook(() => usePageFileDrag());

    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter', ['Files']));
      document.dispatchEvent(makeDragEvent('dragenter', ['Files']));
    });
    act(() => {
      document.dispatchEvent(makeDragEvent('dragleave', ['Files']));
    });
    expect(result.current.isDragging).toBe(true);
  });

  it('pendingFiles is populated on drop and isDragging resets', () => {
    const { result } = renderHook(() => usePageFileDrag());
    const file = new File(['x'], 'test.txt', { type: 'text/plain' });

    act(() => {
      document.dispatchEvent(makeDragEvent('dragenter', ['Files']));
    });
    act(() => {
      document.dispatchEvent(makeDragEvent('drop', ['Files'], [file]));
    });

    expect(result.current.pendingFiles).toHaveLength(1);
    expect(result.current.pendingFiles[0].name).toBe('test.txt');
    expect(result.current.isDragging).toBe(false);
  });

  it('onFilesConsumed clears pendingFiles', () => {
    const { result } = renderHook(() => usePageFileDrag());
    const file = new File(['x'], 'test.txt', { type: 'text/plain' });

    act(() => {
      document.dispatchEvent(makeDragEvent('drop', ['Files'], [file]));
    });
    expect(result.current.pendingFiles).toHaveLength(1);

    act(() => {
      result.current.onFilesConsumed();
    });
    expect(result.current.pendingFiles).toHaveLength(0);
  });

  it('removes all four event listeners on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => usePageFileDrag());
    unmount();
    const events = removeSpy.mock.calls.map((c) => c[0]);
    expect(events).toContain('dragenter');
    expect(events).toContain('dragleave');
    expect(events).toContain('dragover');
    expect(events).toContain('drop');
  });
});

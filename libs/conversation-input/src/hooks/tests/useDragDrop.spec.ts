import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useDragDrop } from '../useDragDrop.js';

const makeDragEvent = (types: string[] = ['Files'], files: File[] = []) =>
  ({
    dataTransfer: { types, files: files as unknown as FileList },
    preventDefault: vi.fn(),
  }) as unknown as React.DragEvent;

describe('useDragDrop', () => {
  it('isDragOver is false initially', () => {
    const { result } = renderHook(() => useDragDrop(vi.fn()));
    expect(result.current.isDragOver).toBe(false);
  });

  it('isDragOver becomes true on dragEnter with Files type', () => {
    const { result } = renderHook(() => useDragDrop(vi.fn()));
    act(() => {
      result.current.dragHandlers.onDragEnter(makeDragEvent(['Files']));
    });
    expect(result.current.isDragOver).toBe(true);
  });

  it('non-file drag is ignored and isDragOver stays false', () => {
    const { result } = renderHook(() => useDragDrop(vi.fn()));
    act(() => {
      result.current.dragHandlers.onDragEnter(makeDragEvent(['text/plain']));
    });
    expect(result.current.isDragOver).toBe(false);
  });

  it('isDragOver goes false after matching dragLeave', () => {
    const { result } = renderHook(() => useDragDrop(vi.fn()));
    act(() => {
      result.current.dragHandlers.onDragEnter(makeDragEvent());
    });
    act(() => {
      result.current.dragHandlers.onDragLeave(makeDragEvent());
    });
    expect(result.current.isDragOver).toBe(false);
  });

  it('nested drag-enter keeps isDragOver true until all leaves', () => {
    const { result } = renderHook(() => useDragDrop(vi.fn()));
    act(() => {
      result.current.dragHandlers.onDragEnter(makeDragEvent());
      result.current.dragHandlers.onDragEnter(makeDragEvent());
    });
    act(() => {
      result.current.dragHandlers.onDragLeave(makeDragEvent());
    });
    expect(result.current.isDragOver).toBe(true);
    act(() => {
      result.current.dragHandlers.onDragLeave(makeDragEvent());
    });
    expect(result.current.isDragOver).toBe(false);
  });

  it('drop resets isDragOver and calls onFiles with dropped files', () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => useDragDrop(onFiles));
    const file = new File(['content'], 'test.pdf');
    act(() => {
      result.current.dragHandlers.onDragEnter(makeDragEvent());
    });
    act(() => {
      result.current.dragHandlers.onDrop(makeDragEvent(['Files'], [file]));
    });
    expect(result.current.isDragOver).toBe(false);
    expect(onFiles).toHaveBeenCalledWith([file]);
  });

  it('drop with no files does not call onFiles', () => {
    const onFiles = vi.fn();
    const { result } = renderHook(() => useDragDrop(onFiles));
    act(() => {
      result.current.dragHandlers.onDrop(makeDragEvent(['Files'], []));
    });
    expect(onFiles).not.toHaveBeenCalled();
  });

  it('dragOver calls preventDefault', () => {
    const { result } = renderHook(() => useDragDrop(vi.fn()));
    const event = makeDragEvent();
    result.current.dragHandlers.onDragOver(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

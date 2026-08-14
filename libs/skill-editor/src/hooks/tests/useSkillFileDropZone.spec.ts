import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSkillFileDropZone } from '../useSkillFileDropZone';

const fileDragEvent = (files: File[] = []) =>
  ({
    dataTransfer: {
      types: ['Files'],
      files,
    },
    preventDefault: vi.fn(),
  }) as unknown as React.DragEvent<HTMLElement>;

const nonFileDragEvent = () =>
  ({
    dataTransfer: { types: ['text/plain'], files: [] },
    preventDefault: vi.fn(),
  }) as unknown as React.DragEvent<HTMLElement>;

describe('useSkillFileDropZone', () => {
  it('activates on drag-enter', () => {
    const { result } = renderHook(() => useSkillFileDropZone(vi.fn()));

    act(() => result.current.dropZoneHandlers.onDragEnter(fileDragEvent()));

    expect(result.current.isDragActive).toBe(true);
  });

  it('does not flicker to inactive on a nested drag-leave while still over the zone', () => {
    const { result } = renderHook(() => useSkillFileDropZone(vi.fn()));

    act(() => {
      result.current.dropZoneHandlers.onDragEnter(fileDragEvent());
      result.current.dropZoneHandlers.onDragEnter(fileDragEvent());
      result.current.dropZoneHandlers.onDragLeave(fileDragEvent());
    });

    expect(result.current.isDragActive).toBe(true);
  });

  it('deactivates once the net enter count returns to zero', () => {
    const { result } = renderHook(() => useSkillFileDropZone(vi.fn()));

    act(() => {
      result.current.dropZoneHandlers.onDragEnter(fileDragEvent());
      result.current.dropZoneHandlers.onDragEnter(fileDragEvent());
      result.current.dropZoneHandlers.onDragLeave(fileDragEvent());
      result.current.dropZoneHandlers.onDragLeave(fileDragEvent());
    });

    expect(result.current.isDragActive).toBe(false);
  });

  it('calls preventDefault on dragover for a file drag', () => {
    const { result } = renderHook(() => useSkillFileDropZone(vi.fn()));
    const event = fileDragEvent();

    act(() => result.current.dropZoneHandlers.onDragOver(event));

    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('ignores a non-file drag', () => {
    const { result } = renderHook(() => useSkillFileDropZone(vi.fn()));

    act(() => result.current.dropZoneHandlers.onDragEnter(nonFileDragEvent()));

    expect(result.current.isDragActive).toBe(false);
  });

  it('calls onFilesDropped with the dropped files and resets drag state', () => {
    const onFilesDropped = vi.fn();
    const { result } = renderHook(() => useSkillFileDropZone(onFilesDropped));
    const file = new File(['content'], 'notes.md');

    act(() => {
      result.current.dropZoneHandlers.onDragEnter(fileDragEvent());
      result.current.dropZoneHandlers.onDrop(fileDragEvent([file]));
    });

    expect(onFilesDropped).toHaveBeenCalledWith([file]);
    expect(result.current.isDragActive).toBe(false);
  });
});

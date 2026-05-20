import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { act, renderHook } from '@testing-library/react';

import { RefObject, createRef } from 'react';

import { useTextareaInsertInPosition } from '@/src/hooks/useTextareaInsertInPosition';

const createTextareaRef = (
  value: string,
  selection: { start: number; end: number },
): RefObject<HTMLTextAreaElement> => {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  document.body.appendChild(textarea);
  textarea.setSelectionRange(selection.start, selection.end);
  return { current: textarea };
};

describe('useTextareaInsertInPosition', () => {
  let requestAnimationFrameSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    requestAnimationFrameSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore();
    document.body.replaceChildren();
  });

  describe('getCursorPosition', () => {
    it('should return selection start and end from the textarea', () => {
      // Arrange
      const textareaRef = createTextareaRef('hello world', {
        start: 3,
        end: 7,
      });
      const { result } = renderHook(() =>
        useTextareaInsertInPosition(textareaRef, 'hello world', vi.fn()),
      );

      // Act
      const position = result.current.getCursorPosition();

      // Assert
      expect(position).toEqual({ start: 3, end: 7 });
    });

    it('should return zero positions when textarea ref is missing', () => {
      // Arrange
      const textareaRef = createRef<HTMLTextAreaElement>();
      const { result } = renderHook(() =>
        useTextareaInsertInPosition(textareaRef, 'hello world', vi.fn()),
      );

      // Act
      const position = result.current.getCursorPosition();

      // Assert
      expect(position).toEqual({ start: 0, end: 0 });
    });
  });

  describe('insertTextAtCursor', () => {
    it('should not update text when textarea ref is missing', () => {
      // Arrange
      const textareaRef = createRef<HTMLTextAreaElement>();
      const setText = vi.fn();
      const { result } = renderHook(() =>
        useTextareaInsertInPosition(textareaRef, 'hello world', setText),
      );

      // Act
      act(() => {
        result.current.insertTextAtCursor('!');
      });

      // Assert
      expect(setText).not.toHaveBeenCalled();
    });

    it('should insert text at the cursor when nothing is selected', () => {
      // Arrange
      const textareaRef = createTextareaRef('hello world', {
        start: 5,
        end: 5,
      });
      const setText = vi.fn();
      const { result } = renderHook(() =>
        useTextareaInsertInPosition(textareaRef, 'hello world', setText),
      );

      // Act
      act(() => {
        result.current.insertTextAtCursor('!!!');
      });

      // Assert
      expect(setText).toHaveBeenCalledWith('hello!!! world');
    });

    it('should replace the selected range with inserted text', () => {
      // Arrange
      const textareaRef = createTextareaRef('hello world', {
        start: 6,
        end: 11,
      });
      const setText = vi.fn();
      const { result } = renderHook(() =>
        useTextareaInsertInPosition(textareaRef, 'hello world', setText),
      );

      // Act
      act(() => {
        result.current.insertTextAtCursor('universe');
      });

      // Assert
      expect(setText).toHaveBeenCalledWith('hello universe');
    });

    it('should restore cursor position and focus the textarea after insert', () => {
      // Arrange
      const textareaRef = createTextareaRef('hello world', {
        start: 5,
        end: 5,
      });
      const setSelectionRange = vi.fn();
      const focus = vi.fn();
      textareaRef.current!.setSelectionRange = setSelectionRange;
      textareaRef.current!.focus = focus;
      const setText = vi.fn();
      const { result } = renderHook(() =>
        useTextareaInsertInPosition(textareaRef, 'hello world', setText),
      );

      // Act
      act(() => {
        result.current.insertTextAtCursor('!!!');
      });

      // Assert
      expect(setSelectionRange).toHaveBeenCalledWith(8, 8);
      expect(focus).toHaveBeenCalled();
    });
  });
});

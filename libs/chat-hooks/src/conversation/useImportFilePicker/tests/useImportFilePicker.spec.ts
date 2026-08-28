import { act, renderHook } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useImportFilePicker } from '../useImportFilePicker';

describe('useImportFilePicker', () => {
  it('selects a file and resets the input so the same file can be selected again', () => {
    const onFileSelected = vi.fn();
    const file = new File(['content'], 'conversation.json', {
      type: 'application/json',
    });
    const input = document.createElement('input');
    input.type = 'file';
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    const { result } = renderHook(() =>
      useImportFilePicker({ onFileSelected }),
    );

    act(() => {
      result.current.handleFileChange({
        target: input,
      } as ChangeEvent<HTMLInputElement>);
      result.current.handleFileChange({
        target: input,
      } as ChangeEvent<HTMLInputElement>);
    });

    expect(onFileSelected).toHaveBeenNthCalledWith(1, file);
    expect(onFileSelected).toHaveBeenNthCalledWith(2, file);
    expect(input.value).toBe('');
  });

  it('programmatically clicks the attached input', () => {
    const input = document.createElement('input');
    const click = vi.spyOn(input, 'click');
    const { result } = renderHook(() =>
      useImportFilePicker({ onFileSelected: vi.fn() }),
    );
    result.current.inputRef.current = input;

    act(() => result.current.triggerImport());

    expect(click).toHaveBeenCalledOnce();
  });

  it('applies and clears the host-resolved accept value', () => {
    const input = document.createElement('input');
    const { result, rerender } = renderHook(
      ({ accept }) => useImportFilePicker({ accept, onFileSelected: vi.fn() }),
      { initialProps: { accept: undefined as string | undefined } },
    );
    result.current.inputRef.current = input;

    rerender({ accept: 'application/json,.json' });
    expect(input.accept).toBe('application/json,.json');

    rerender({ accept: undefined });
    expect(input.hasAttribute('accept')).toBe(false);
  });
});

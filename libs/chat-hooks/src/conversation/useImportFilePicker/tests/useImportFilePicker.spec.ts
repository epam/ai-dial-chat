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
      useImportFilePicker({ isMobile: false, onFileSelected }),
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
      useImportFilePicker({ isMobile: false, onFileSelected: vi.fn() }),
    );
    result.current.inputRef.current = input;

    act(() => result.current.triggerImport());

    expect(click).toHaveBeenCalledOnce();
  });
});

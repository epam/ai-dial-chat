import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  TextRefinementCallback,
  TextRefinementState,
  useTextRefinement,
} from '../useTextRefinement';

const deferred = () => {
  let resolve!: (value: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const controlled = (
  callback: TextRefinementCallback | undefined,
  initialValue = '  Original\n',
) =>
  renderHook(
    ({
      onRefine,
      resetKey,
      disabled,
    }: {
      onRefine?: TextRefinementCallback;
      resetKey: number;
      disabled: boolean;
    }) => {
      const [value, setValue] = useState(initialValue);
      const refinement = useTextRefinement({
        value,
        onChange: setValue,
        onRefine,
        resetKey,
        disabled,
      });
      return { value, setValue, ...refinement };
    },
    { initialProps: { onRefine: callback, resetKey: 1, disabled: false } },
  );

describe('useTextRefinement', () => {
  it('acknowledges controlled results and restores exact whitespace with Undo', async () => {
    const { result } = controlled(vi.fn(async () => 'Refined'));
    await act(async () => {
      await result.current.refine();
    });
    expect(result.current.value).toBe('Refined');
    expect(result.current.state).toBe(TextRefinementState.Success);
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.value).toBe('  Original\n');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.state).toBe(TextRefinementState.Restored);
  });
  it('preserves the first baseline across repeat refinement, unchanged output and failed retries', async () => {
    const callback = vi
      .fn()
      .mockResolvedValueOnce('B')
      .mockResolvedValueOnce('C')
      .mockResolvedValueOnce('C')
      .mockRejectedValueOnce(new Error('unavailable'));
    const { result } = controlled(callback, 'A');
    for (let i = 0; i < 4; i++)
      await act(async () => {
        await result.current.refine();
      });
    expect(result.current.value).toBe('C');
    expect(result.current.state).toBe(TextRefinementState.Error);
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.value).toBe('A');
  });
  it('makes no write and creates no Undo for identical text', async () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useTextRefinement({
        value: 'A',
        onChange,
        onRefine: async (text) => text,
      }),
    );
    await act(async () => {
      await result.current.refine();
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.canUndo).toBe(false);
    expect(result.current.state).toBe(TextRefinementState.Unchanged);
  });
  it('invalidates Undo on manual editing and starts the next baseline at that edit', async () => {
    const { result } = controlled(async () => 'B', 'A');
    await act(async () => {
      await result.current.refine();
    });
    act(() => result.current.setValue('Edited'));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.state).toBe(TextRefinementState.Idle);
    await act(async () => {
      await result.current.refine();
    });
    act(() => result.current.undo());
    expect(result.current.value).toBe('Edited');
  });
  it.each(['', ' \n'])('disables blank input %j', async (value) => {
    const callback = vi.fn();
    const { result } = controlled(callback, value);
    expect(result.current.canRefine).toBe(false);
    await act(async () => {
      await result.current.refine();
    });
    expect(callback).not.toHaveBeenCalled();
  });
  it('treats whitespace output as a recoverable failure', async () => {
    const callback = vi
      .fn()
      .mockResolvedValueOnce(' \n')
      .mockResolvedValueOnce('B');
    const { result } = controlled(callback, 'A');
    await act(async () => {
      await result.current.refine();
    });
    expect(result.current.state).toBe(TextRefinementState.Error);
    expect(result.current.value).toBe('A');
    await act(async () => {
      await result.current.refine();
    });
    expect(result.current.value).toBe('B');
  });
  it('ignores rapid duplicate activations synchronously', async () => {
    const pending = deferred();
    const callback = vi.fn<TextRefinementCallback>(() => pending.promise);
    const { result } = controlled(callback);
    act(() => {
      result.current.refine();
      result.current.refine();
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(true);
    await act(async () => pending.resolve('B'));
  });
  it('keeps independent instances and their baselines separate', async () => {
    const { result: first } = controlled(async () => 'B', 'A');
    const { result: second } = controlled(async () => 'Y', 'X');
    await act(async () => {
      await first.current.refine();
      await second.current.refine();
    });
    act(() => first.current.undo());
    expect(first.current.value).toBe('A');
    expect(second.current.value).toBe('Y');
    expect(second.current.canUndo).toBe(true);
  });
  it('does not cancel on callback identity changes', async () => {
    const pending = deferred();
    let signal!: AbortSignal;
    const callback: TextRefinementCallback = (_value, received) => {
      signal = received;
      return pending.promise;
    };
    const { result, rerender } = controlled(callback, 'A');
    act(() => {
      result.current.refine();
    });
    rerender({ onRefine: async () => 'Other', resetKey: 1, disabled: false });
    expect(signal.aborted).toBe(false);
    await act(async () => pending.resolve('B'));
    expect(result.current.value).toBe('B');
    expect(result.current.canUndo).toBe(true);
  });
  it.each([
    'replacement',
    'reset',
    'identity',
    'removed',
    'disabled',
    'unmount',
  ])(
    'suppresses late results after %s even if the host ignores abort',
    async (action) => {
      const pending = deferred();
      const callback = vi.fn<TextRefinementCallback>(() => pending.promise);
      const { result, rerender, unmount } = controlled(callback, 'A');
      act(() => {
        result.current.refine();
      });
      const signal = callback.mock.calls[0][1];
      act(() => {
        if (action === 'replacement') result.current.setValue('New draft');
        if (action === 'reset') result.current.reset();
        if (action === 'unmount') unmount();
      });
      if (action === 'identity')
        rerender({ onRefine: callback, resetKey: 2, disabled: false });
      if (action === 'removed')
        rerender({ onRefine: undefined, resetKey: 1, disabled: false });
      if (action === 'disabled')
        rerender({ onRefine: callback, resetKey: 1, disabled: true });
      expect(signal.aborted).toBe(true);
      await act(async () => pending.resolve('Late result'));
      expect(result.current.value).toBe(
        action === 'replacement' ? 'New draft' : 'A',
      );
      expect(result.current.canUndo).toBe(false);
    },
  );
  it('silently ignores aborted rejections and stale errors after reset', async () => {
    const pending = deferred();
    const { result } = controlled(() => pending.promise);
    act(() => {
      result.current.refine();
      result.current.reset();
    });
    await act(async () => pending.reject(new Error('late failure')));
    expect(result.current.state).toBe(TextRefinementState.Idle);
    const { result: aborted } = controlled(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    await act(async () => {
      await aborted.current.refine();
    });
    expect(aborted.current.state).toBe(TextRefinementState.Idle);
  });
});

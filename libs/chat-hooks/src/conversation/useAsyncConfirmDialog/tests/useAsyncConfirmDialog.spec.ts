import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAsyncConfirmDialog } from '../useAsyncConfirmDialog';

describe('useAsyncConfirmDialog', () => {
  it('opens with a pending value and clears a previous error', async () => {
    const { result } = renderHook(() => useAsyncConfirmDialog<string>());

    act(() => result.current.open('first'));
    await act(() =>
      result.current.confirm(
        () => Promise.reject(new Error('failed')),
        () => 'Resolved error',
      ),
    );
    act(() => result.current.open('second'));

    expect(result.current.pending).toBe('second');
    expect(result.current.isPending).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('guards re-entry synchronously while the first run is unresolved', async () => {
    let resolveRun!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRun = resolve;
        }),
    );
    const { result } = renderHook(() => useAsyncConfirmDialog<string>());
    act(() => result.current.open('conversation'));

    let firstConfirm!: Promise<void>;
    act(() => {
      firstConfirm = result.current.confirm(run, () => 'error');
      void result.current.confirm(run, () => 'error');
    });

    expect(run).toHaveBeenCalledOnce();
    expect(result.current.isRunning).toBe(true);

    resolveRun();
    await act(() => firstConfirm);
  });

  it('keeps the dialog open and resolves the caller error on failure', async () => {
    const failure = new Error('network');
    const onError = vi.fn(() => 'Try again');
    const { result } = renderHook(() => useAsyncConfirmDialog<string>());
    act(() => result.current.open('conversation'));

    await act(() =>
      result.current.confirm(() => Promise.reject(failure), onError),
    );

    expect(onError).toHaveBeenCalledWith(failure);
    expect(result.current.pending).toBe('conversation');
    expect(result.current.isPending).toBe(true);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBe('Try again');
  });

  it('closes and clears state after a successful confirmation', async () => {
    const { result } = renderHook(() => useAsyncConfirmDialog<string>());
    act(() => result.current.open('conversation'));

    await act(() =>
      result.current.confirm(
        () => Promise.resolve(),
        () => 'error',
      ),
    );

    expect(result.current.pending).toBeNull();
    expect(result.current.isPending).toBe(false);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not let an obsolete run close a newer pending dialog', async () => {
    let resolveRun!: () => void;
    const { result } = renderHook(() => useAsyncConfirmDialog<string>());
    act(() => result.current.open('first'));

    let firstConfirm!: Promise<void>;
    act(() => {
      firstConfirm = result.current.confirm(
        () =>
          new Promise<void>((resolve) => {
            resolveRun = resolve;
          }),
        () => 'error',
      );
    });
    act(() => {
      result.current.close();
      result.current.open('second');
    });

    resolveRun();
    await act(() => firstConfirm);

    expect(result.current.pending).toBe('second');
    expect(result.current.isPending).toBe(true);
  });
});

import { act, render, renderHook, screen } from '@testing-library/react';
import { createElement, Fragment } from 'react';
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
  describe('focus restoration', () => {
    /*
     * Two real buttons stand in for the control that opens the dialog and for
     * the dialog itself: focusing "Elsewhere" is how a mounted dialog would
     * take focus away from the opener.
     */
    const triggers = (labels: string[]) =>
      createElement(
        Fragment,
        null,
        ...labels.map((label) =>
          createElement('button', { key: label, type: 'button' }, label),
        ),
      );

    /* Keyed children, and the same element shape on rerender, so React removes
     * only the button that disappeared instead of remounting the whole tree —
     * the surviving node has to be the very node the hook captured. */
    const mountTriggers = (labels: string[]) => {
      const view = render(triggers(labels));
      return (next: string[]) => view.rerender(triggers(next));
    };

    const button = (name: string) => screen.getByRole('button', { name });
    const isFocused = (name: string) => button(name).matches(':focus');

    it('returns focus to whatever was focused when the dialog opened', () => {
      mountTriggers(['Open', 'Elsewhere']);
      button('Open').focus();
      const { result } = renderHook(() => useAsyncConfirmDialog<string>());

      act(() => result.current.open('conv-1'));
      button('Elsewhere').focus();
      act(() => result.current.close());

      expect(isFocused('Open')).toBe(true);
    });

    it('prefers an explicitly named return target over the focused element', () => {
      /* The kebab renders first so the rerender below removes only the menu
       * item, leaving the captured trigger node itself untouched. */
      const remountTriggers = mountTriggers([
        'Conversation actions',
        'Revoke access',
      ]);
      button('Revoke access').focus();
      const kebab = button('Conversation actions');
      const { result } = renderHook(() => useAsyncConfirmDialog<string>());

      act(() => result.current.open('conv-1', kebab));
      /* The menu item unmounts with its menu, exactly as it does in the app. */
      remountTriggers(['Conversation actions']);
      act(() => result.current.close());

      expect(isFocused('Conversation actions')).toBe(true);
    });

    it('restores focus after a successful confirmation, not only after a cancel', async () => {
      mountTriggers(['Open', 'Elsewhere']);
      button('Open').focus();
      const { result } = renderHook(() => useAsyncConfirmDialog<string>());

      act(() => result.current.open('conv-1'));
      button('Elsewhere').focus();
      await act(() =>
        result.current.confirm(
          () => Promise.resolve(),
          () => 'unused',
        ),
      );

      expect(isFocused('Open')).toBe(true);
    });

    it('leaves focus alone when the return target is gone from the document', () => {
      const remountTriggers = mountTriggers(['Open', 'Elsewhere']);
      button('Open').focus();
      const { result } = renderHook(() => useAsyncConfirmDialog<string>());

      act(() => result.current.open('conv-1'));
      remountTriggers(['Elsewhere']);
      act(() => result.current.close());

      expect(isFocused('Elsewhere')).toBe(false);
    });

    it('keeps focus in the dialog while a failed confirmation leaves it open', async () => {
      mountTriggers(['Open', 'Elsewhere']);
      button('Open').focus();
      const { result } = renderHook(() => useAsyncConfirmDialog<string>());

      act(() => result.current.open('conv-1'));
      button('Elsewhere').focus();
      await act(() =>
        result.current.confirm(
          () => Promise.reject(new Error('failed')),
          () => 'Resolved error',
        ),
      );

      expect(result.current.isPending).toBe(true);
      expect(isFocused('Elsewhere')).toBe(true);
    });
  });
});

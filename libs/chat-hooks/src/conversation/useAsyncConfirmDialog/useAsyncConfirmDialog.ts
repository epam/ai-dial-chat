import { useCallback, useEffect, useRef, useState } from 'react';

/** State and controls returned by `useAsyncConfirmDialog`. */
export interface AsyncConfirmDialogControls<T> {
  /**
   * The value currently awaiting confirmation, or `null` when no dialog is
   * open.
   */
  pending: T | null;
  /** `true` when `pending` is not `null`. */
  isPending: boolean;
  /** `true` while the async operation started by `confirm` is in-flight. */
  isRunning: boolean;
  /** Error message set when the last `confirm` run threw, or `null` otherwise. */
  error: string | null;
  /**
   * Opens the dialog by setting `pending` to `value` and clearing any prior
   * error.
   *
   * Pass `returnFocusTo` when the control that opened the dialog will not
   * survive it — a row menu item, for instance, unmounts with its menu, so
   * restoring focus to it is impossible and the caller should name a stable
   * element such as the menu's own trigger. When omitted, whatever held focus
   * at the moment of the call is used.
   */
  open: (value: T, returnFocusTo?: HTMLElement | null) => void;
  /** Closes the dialog by resetting `pending`, `error`, and `isRunning` to their initial values. */
  close: () => void;
  /**
   * Runs `run(pending)` while enforcing a re-entry guard.
   *
   * - No-op when `isRunning` is already `true` or `pending` is `null`.
   * - On success: calls `close()` to reset all state.
   * - On failure: sets `error` to `onError(caughtError)` and leaves `pending`
   *   set so the caller may retry.
   */
  confirm: (
    run: (value: T) => Promise<void>,
    onError: (error: unknown) => string,
  ) => Promise<void>;
}

/**
 * Generic single-slot pending / loading / error state machine for
 * confirmation dialogs that trigger an async operation.
 *
 * Replaces the `[pendingXxx, setXxx] / [isXxxing, setIsXxxing] / [xxxError,
 * setXxxError]` triads that previously appeared inline at each call site in
 * `ConversationPanelView` and `ConversationPanelMenu`.
 */
export const useAsyncConfirmDialog = <T>(): AsyncConfirmDialogControls<T> => {
  const [pending, setPending] = useState<T | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef<T | null>(null);
  const isRunningRef = useRef(false);
  const operationIdRef = useRef(0);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback((value: T, returnFocusTo?: HTMLElement | null) => {
    const { activeElement } = document;
    returnFocusRef.current =
      returnFocusTo ??
      (activeElement instanceof HTMLElement ? activeElement : null);
    operationIdRef.current += 1;
    pendingRef.current = value;
    isRunningRef.current = false;
    setPending(value);
    setIsRunning(false);
    setError(null);
  }, []);

  /*
   * Returns keyboard focus to the control the dialog was opened from once it
   * closes, whether it was confirmed, cancelled or dismissed. Without this the
   * dialog unmounts with focus on it and the browser drops focus to <body>,
   * stranding a keyboard user at the top of the document.
   *
   * It runs as an effect rather than inside close(): the restore has to land
   * after the commit that unmounts the dialog, or the dialog's own teardown
   * blurs the element we just focused.
   */
  useEffect(() => {
    if (pending != null) return;
    const opener = returnFocusRef.current;
    returnFocusRef.current = null;
    if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }, [pending]);

  const close = useCallback(() => {
    operationIdRef.current += 1;
    pendingRef.current = null;
    isRunningRef.current = false;
    setPending(null);
    setError(null);
    setIsRunning(false);
  }, []);

  const confirm = useCallback(
    async (
      run: (value: T) => Promise<void>,
      onError: (error: unknown) => string,
    ) => {
      const currentPending = pendingRef.current;
      if (isRunningRef.current || currentPending == null) return;
      const operationId = ++operationIdRef.current;
      isRunningRef.current = true;
      setIsRunning(true);
      setError(null);
      try {
        await run(currentPending);
        if (operationId !== operationIdRef.current) return;
        pendingRef.current = null;
        setPending(null);
        setError(null);
        isRunningRef.current = false;
        setIsRunning(false);
      } catch (e) {
        if (operationId !== operationIdRef.current) return;
        setError(onError(e));
        isRunningRef.current = false;
        setIsRunning(false);
      }
    },
    [],
  );

  return {
    pending,
    isPending: pending != null,
    isRunning,
    error,
    open,
    close,
    confirm,
  };
};

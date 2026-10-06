import { useCallback, useEffect, useRef, useState } from 'react';

/** Result of {@link useUnsavedChangesGuard}. */
export interface UnsavedChangesGuardResult {
  /** Runs `action` immediately when nothing is dirty; otherwise defers it and opens the confirmation. */
  guard: (action: () => void) => void;
  /** Whether the discard confirmation should be shown. */
  isConfirmOpen: boolean;
  /** Closes the confirmation and runs the deferred action. */
  confirm: () => void;
  /** Closes the confirmation and drops the deferred action. */
  dismiss: () => void;
}

/** Defers leaving a form with unsaved changes until the user confirms, and asks the browser to warn before the page unloads. */
export const useUnsavedChangesGuard = (
  isDirty: boolean,
): UnsavedChangesGuardResult => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const guard = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      pendingAction.current = action;
      setIsConfirmOpen(true);
    },
    [isDirty],
  );

  const confirm = useCallback(() => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setIsConfirmOpen(false);
    action?.();
  }, []);

  const dismiss = useCallback(() => {
    pendingAction.current = null;
    setIsConfirmOpen(false);
  }, []);

  return { guard, isConfirmOpen, confirm, dismiss };
};

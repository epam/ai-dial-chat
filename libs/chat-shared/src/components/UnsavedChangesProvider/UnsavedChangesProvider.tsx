import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { ConfirmationDialog } from '../ConfirmationDialog/ConfirmationDialog';
import {
  UnsavedChangesContext,
  UnsavedChangesInternalContext,
  type PendingDiscard,
} from './unsaved-changes-context';

/** User-visible strings of the unsaved-changes dialog. */
export interface UnsavedChangesLabels {
  /** Dialog title, which also names the dialog. Defaults to `'Discard unsaved changes?'`. */
  title?: string;
  /** Dialog message. Defaults to `'You have unsaved changes. Leaving now will discard them.'`. */
  message?: string;
  /** Label of the discarding action. Defaults to `'Discard changes'`. */
  confirmLabel?: string;
  /** Label of the action that keeps the edits. Defaults to `'Keep editing'`. */
  cancelLabel?: string;
}

const DEFAULT_UNSAVED_CHANGES_LABELS: Required<UnsavedChangesLabels> = {
  title: 'Discard unsaved changes?',
  message: 'You have unsaved changes. Leaving now will discard them.',
  confirmLabel: 'Discard changes',
  cancelLabel: 'Keep editing',
};

/** Props for `UnsavedChangesProvider`. */
export interface UnsavedChangesProviderProps {
  /** Subtree whose forms and exits share the dialog. */
  children: ReactNode;
  /** User-visible strings of the dialog; each missing field keeps its English default. */
  labels?: UnsavedChangesLabels;
}

/** Owns the single "Discard unsaved changes?" dialog and the dirty state of the one guarded form mounted below it. */
export const UnsavedChangesProvider: FC<UnsavedChangesProviderProps> = ({
  children,
  labels,
}) => {
  const [isRegisteredDirty, setIsRegisteredDirty] = useState(false);
  const [pending, setPending] = useState<PendingDiscard | null>(null);
  const unloadAllowedRef = useRef(false);
  const resolvedLabels: Required<UnsavedChangesLabels> = {
    title: labels?.title ?? DEFAULT_UNSAVED_CHANGES_LABELS.title,
    message: labels?.message ?? DEFAULT_UNSAVED_CHANGES_LABELS.message,
    confirmLabel:
      labels?.confirmLabel ?? DEFAULT_UNSAVED_CHANGES_LABELS.confirmLabel,
    cancelLabel:
      labels?.cancelLabel ?? DEFAULT_UNSAVED_CHANGES_LABELS.cancelLabel,
  };

  useEffect(
    () => () => {
      unloadAllowedRef.current = false;
    },
    [],
  );

  const register = useCallback((isDirty: boolean) => {
    setIsRegisteredDirty(isDirty);
    return () => setIsRegisteredDirty(false);
  }, []);

  const open = useCallback((next: PendingDiscard) => {
    unloadAllowedRef.current = false;
    setPending(next);
    return () => setPending((current) => (current === next ? null : current));
  }, []);

  const requestDiscard = useCallback(
    (onDiscard: () => void) => {
      open({ onDiscard, shouldAllowUnload: true });
    },
    [open],
  );

  const handleConfirm = () => {
    if (!pending) return;
    setPending(null);
    if (pending.shouldAllowUnload) unloadAllowedRef.current = true;
    pending.onDiscard();
  };

  const handleClose = () => {
    if (!pending) return;
    setPending(null);
    pending.onKeep?.();
  };

  const value = useMemo(
    () => ({ hasUnsavedChanges: isRegisteredDirty, requestDiscard }),
    [isRegisteredDirty, requestDiscard],
  );

  const internalValue = useMemo(
    () => ({ register, open, unloadAllowedRef }),
    [register, open],
  );

  return (
    <UnsavedChangesInternalContext.Provider value={internalValue}>
      <UnsavedChangesContext.Provider value={value}>
        {children}
        <ConfirmationDialog
          open={pending != null}
          title={resolvedLabels.title}
          message={resolvedLabels.message}
          confirmLabel={resolvedLabels.confirmLabel}
          cancelLabel={resolvedLabels.cancelLabel}
          variant={ConfirmationPopupVariant.Danger}
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      </UnsavedChangesContext.Provider>
    </UnsavedChangesInternalContext.Provider>
  );
};

import { ConfirmationDialog } from '@epam/ai-dial-chat-shared';
import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import {
  createContext,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { UnsavedChangesI18nKeys } from '../constants/translation-keys';

interface UnsavedChangesContextType {
  /** Whether the mounted builder reports unsaved changes. `false` when no builder is mounted. */
  hasUnsavedChanges: boolean;
  /**
   * Opens the unsaved-changes dialog. **Discard changes** allows the next page
   * unload, closes the dialog and runs `onDiscard`; **Keep editing** or any
   * dismissal closes it and runs nothing. Used by flows that are not router
   * transitions, such as Log out.
   */
  requestDiscard: (onDiscard: () => void) => void;
}

/** Actions run by the dialog's two outcomes. */
interface PendingDiscard {
  onDiscard: () => void;
  onKeep?: () => void;
  /** Whether confirming lets the next `beforeunload` pass without the native prompt. */
  shouldAllowUnload?: boolean;
}

interface UnsavedChangesInternalContextType {
  /** Registers the mounted builder's dirty state; the returned callback unregisters it. */
  register: (isDirty: boolean) => () => void;
  /**
   * Opens the dialog wired to the given outcomes. The returned callback closes
   * it without running either outcome, and does nothing once the dialog has
   * been answered or another request has replaced it.
   */
  open: (pending: PendingDiscard) => () => void;
  /** Set once a discard has allowed the page to unload; the builder's `beforeunload` listener skips its prompt while it is `true`. */
  unloadAllowedRef: RefObject<boolean>;
}

const UnsavedChangesContext = createContext<
  UnsavedChangesContextType | undefined
>(undefined);

const UnsavedChangesInternalContext = createContext<
  UnsavedChangesInternalContextType | undefined
>(undefined);

/**
 * Owns the single "Discard unsaved changes?" dialog shared by every builder
 * page, and the dirty state of whichever builder is mounted. Builders feed it
 * through `useBuilderLeaveGuard`; `Navigation` reads it to guard Log out.
 */
export const UnsavedChangesProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const [isRegisteredDirty, setIsRegisteredDirty] = useState(false);
  const [pending, setPending] = useState<PendingDiscard | null>(null);
  const unloadAllowedRef = useRef(false);

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
          title={t(UnsavedChangesI18nKeys.Title)}
          message={t(UnsavedChangesI18nKeys.Message)}
          confirmLabel={t(UnsavedChangesI18nKeys.ConfirmLabel)}
          cancelLabel={t(UnsavedChangesI18nKeys.CancelLabel)}
          variant={ConfirmationPopupVariant.Danger}
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      </UnsavedChangesContext.Provider>
    </UnsavedChangesInternalContext.Provider>
  );
};

/** Dirty state of the mounted builder and the dialog entry point for non-router exits. */
export const useUnsavedChanges = (): UnsavedChangesContextType => {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error(
      'useUnsavedChanges must be used within an UnsavedChangesProvider',
    );
  }
  return context;
};

/** Registration and dialog plumbing for `useBuilderLeaveGuard` only. */
export const useUnsavedChangesInternal =
  (): UnsavedChangesInternalContextType => {
    const context = useContext(UnsavedChangesInternalContext);
    if (!context) {
      throw new Error(
        'useBuilderLeaveGuard must be used within an UnsavedChangesProvider',
      );
    }
    return context;
  };

import { createContext, useContext, type RefObject } from 'react';

/** Value of {@link useUnsavedChanges}. */
export interface UnsavedChangesContextValue {
  /** Whether the guarded form reports unsaved changes. `false` when no form is registered. */
  hasUnsavedChanges: boolean;
  /**
   * Opens the unsaved-changes dialog. **Discard changes** allows the next page
   * unload, closes the dialog and runs `onDiscard`; **Keep editing** or any
   * dismissal closes it and runs nothing. Used by exits that are not router
   * transitions, such as Log out.
   */
  requestDiscard: (onDiscard: () => void) => void;
}

/** Actions run by the dialog's two outcomes. */
export interface PendingDiscard {
  /** Runs when the user chooses Discard changes. */
  onDiscard: () => void;
  /** Runs when the user chooses Keep editing or dismisses the dialog. */
  onKeep?: () => void;
  /** Whether confirming lets the next `beforeunload` pass without the native prompt. Defaults to `false`. */
  shouldAllowUnload?: boolean;
}

/** Registration and dialog plumbing shared by the provider and the leave-guard hooks. */
export interface UnsavedChangesInternalContextValue {
  /** Registers the guarded form's dirty state; the returned callback unregisters it. */
  register: (isDirty: boolean) => () => void;
  /**
   * Opens the dialog wired to the given outcomes. The returned callback closes
   * it without running either outcome, and does nothing once the dialog has
   * been answered or another request has replaced it.
   */
  open: (pending: PendingDiscard) => () => void;
  /** Set once a discard has allowed the page to unload; the `beforeunload` listener skips its prompt while it is `true`. */
  unloadAllowedRef: RefObject<boolean>;
}

/** Public unsaved-changes state, read through `useUnsavedChanges`. */
export const UnsavedChangesContext = createContext<
  UnsavedChangesContextValue | undefined
>(undefined);

/** Registration and dialog plumbing, read through `useUnsavedChangesInternal`. */
export const UnsavedChangesInternalContext = createContext<
  UnsavedChangesInternalContextValue | undefined
>(undefined);

/** Returns the guarded form's dirty state and the dialog entry point for exits that are not router transitions; throws outside `UnsavedChangesProvider`. */
export const useUnsavedChanges = (): UnsavedChangesContextValue => {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error(
      'useUnsavedChanges must be used within an UnsavedChangesProvider',
    );
  }
  return context;
};

/** Returns the registration and dialog plumbing for the leave-guard hooks; throws outside `UnsavedChangesProvider`. Not re-exported from the package. */
export const useUnsavedChangesInternal =
  (): UnsavedChangesInternalContextValue => {
    const context = useContext(UnsavedChangesInternalContext);
    if (!context) {
      throw new Error(
        'The unsaved-changes leave guard must be used within an UnsavedChangesProvider',
      );
    }
    return context;
  };

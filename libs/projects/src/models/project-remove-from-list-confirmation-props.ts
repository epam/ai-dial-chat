import type { ReactNode } from 'react';

/** Strings of the {@link ProjectRemoveFromListConfirmation} component. */
export interface ProjectRemoveFromListConfirmationLabels {
  /** Dialog title. Defaults to `'Remove from My List'`. */
  title?: string;
  /** Label of the confirming button. Defaults to `'Remove from My List'`. */
  confirmLabel?: string;
  /** Label of the cancel button. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Status announced while the removal is in flight. Defaults to `'Removing…'`. */
  removingStatusLabel?: string;
  /** What removing costs the user, one line each. Defaults to losing access, others keeping theirs and needing a new invitation. */
  consequences?: string[];
  /** Builds the dialog message from the project name. Defaults to an English sentence with the name in bold. */
  message?: (projectName: string) => ReactNode;
}

/** Props for the {@link ProjectRemoveFromListConfirmation} component. */
export interface ProjectRemoveFromListConfirmationProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Name of the shared project being removed from the user's list. */
  projectName: string;
  /** Whether the removal is in flight; both actions are blocked while it is. Defaults to `false`. */
  isRemoving?: boolean;
  /** Called when the user confirms the removal. */
  onConfirm: () => void;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
  /** Strings of the dialog; each falls back to its English default. */
  labels?: ProjectRemoveFromListConfirmationLabels;
}

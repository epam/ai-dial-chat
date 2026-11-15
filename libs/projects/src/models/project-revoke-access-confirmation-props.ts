import type { ReactNode } from 'react';

/** Strings of the {@link ProjectRevokeAccessConfirmation} component. */
export interface ProjectRevokeAccessConfirmationLabels {
  /** Dialog title. Defaults to `'Revoke access'`. */
  title?: string;
  /** Label of the confirming button. Defaults to `'Revoke access'`. */
  confirmLabel?: string;
  /** Label of the cancel button. Defaults to `'Cancel'`. */
  cancelLabel?: string;
  /** Status announced while the revoke is in flight. Defaults to `'Revoking access…'`. */
  revokingStatusLabel?: string;
  /** What revoking costs the user, one line each. Defaults to recipients losing access, links stopping working and the owner's copy remaining. */
  consequences?: string[];
  /** Builds the dialog message from the project name. Defaults to an English sentence with the name in bold. */
  message?: (projectName: string) => ReactNode;
}

/** Props for the {@link ProjectRevokeAccessConfirmation} component. */
export interface ProjectRevokeAccessConfirmationProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Name of the project whose shared access is being revoked. */
  projectName: string;
  /** Whether the revoke is in flight; both actions are blocked while it is. Defaults to `false`. */
  isRevoking?: boolean;
  /** Called when the user confirms the revoke. */
  onConfirm: () => void;
  /** Called when the dialog is dismissed. */
  onClose: () => void;
  /** Strings of the dialog; each falls back to its English default. */
  labels?: ProjectRevokeAccessConfirmationLabels;
}

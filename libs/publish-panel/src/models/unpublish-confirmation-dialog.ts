/** Copy for {@link UnpublishConfirmationDialog}; every field has an English default. */
export interface UnpublishConfirmationDialogLabels {
  /** Dialog title. Default: `'Unpublish?'`. */
  title?: string;
  /** Confirm button label. Default: `'Unpublish'`. */
  confirmLabel?: string;
  /** Cancel button label. Default: `'Cancel'`. */
  cancelLabel?: string;
  /** Name of the public root folder (path `''`). Default: `'Organization'`. */
  rootFolderLabel?: string;
  /** Accessible name of the folder radio group. Default: `'Published folders'`. */
  folderGroupAriaLabel?: string;
  /** Status announced while the request runs. Default: `'Requesting unpublish…'`. */
  loadingStatusLabel?: string;
  /** Message for a single published folder, given the entity name and the folder's display name. Default: `` `Unpublish "${name}" from "${folder}"?` ``. */
  confirmMessage?: (name: string, folder: string) => string;
  /** Message asking the user to pick one of several folders. Default: `` `Choose which folder to unpublish "${name}" from.` ``. */
  selectFolderMessage?: (name: string) => string;
}

/** Color overrides for {@link UnpublishConfirmationDialog}, applied as CSS custom properties with app theme fallbacks. */
export interface UnpublishConfirmationDialogColors {
  /** Text color of each folder option. Fallback: `--text-primary`. */
  optionText?: string;
}

/** Props for {@link UnpublishConfirmationDialog}. */
export interface UnpublishConfirmationDialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Name of the entity being unpublished, interpolated into the message. */
  name: string;
  /** Published folders as `/`-joined paths; `''` is the public root. */
  folders: string[];
  /** The picked folder when there are several; `null` until one is picked. */
  selectedFolder: string | null;
  /** Called with the folder the user picks. */
  onSelectedFolderChange: (folder: string) => void;
  /** Whether the unpublish request is running; disables both actions and the folder options. Default: `false`. */
  isLoading?: boolean;
  /** Copy overrides. */
  labels?: UnpublishConfirmationDialogLabels;
  /** Typography class for each folder option. Default: `'dial-small-text'`. */
  optionClassName?: string;
  /** Color overrides. */
  colors?: UnpublishConfirmationDialogColors;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called when the dialog should close. */
  onClose: () => void;
}

/*
 * `DialFileManager` is imported as a type: it is used only inside
 * `typeof`/`ComponentProps` type queries, and a value import here would put
 * the grid in the closure of this package's root entry, which every host
 * reaches (see the note in `./index.ts`).
 */
import type {
  DialFileManager,
  DialFileManagerTabs,
} from '@epam/ai-dial-react-file-manager';
import type { TransferQueueLabels } from '@epam/ai-dial-ui-kit';
import type { ComponentProps, ReactNode } from 'react';

type DialFileManagerComponentProps = ComponentProps<typeof DialFileManager>;

/** Options for the conflict-resolution popup shown during copy/move operations. */
export type ConflictResolutionPopupOptions = NonNullable<
  DialFileManagerComponentProps['conflictResolutionPopupOptions']
>;

/** Validation messages shown during inline rename editing. */
export type RenameValidationMessages = NonNullable<
  DialFileManagerComponentProps['renameValidationMessages']
>;

/** Configuration for the destination-folder picker popup. */
export type DialFileManagerDestinationFolderPopupOptions = NonNullable<
  DialFileManagerComponentProps['destinationFolderPopupOptions']
>;

/** Title and description pair for an empty-state display. */
export interface EmptyStateCopy {
  /** Primary empty-state heading. */
  title: string;
  /** Secondary empty-state description text. */
  description: string;
}

/**
 * Pre-translated strings and resolved renderers the shell renders as-is.
 * The shell never calls `useTranslation` — every host (the attach modal
 * today; a future standalone page) resolves these via its own i18n.
 */
export interface DialFileManagerShellLabels {
  /** Error message shown when the current folder listing fails. */
  errorMessage: string;
  /** Label for the retry button shown alongside the error message. */
  retryLabel: string;
  /** Label for the hidden-files toggle in the toolbar. */
  hiddenFilesLabel: string;
  /** Label shown when hidden files are currently visible. */
  showHiddenFilesLabel: string;
  /** Label shown when hidden files are currently hidden. */
  hideHiddenFilesLabel: string;
  /** Returns a bulk-selection count label (e.g. "3 selected"). */
  getSelectionLabel: (count: number) => string;
  /** Label for the "Upload files" action in the New menu. */
  uploadFilesLabel: string;
  /** Label for the "Upload archive" action in the New menu. */
  uploadArchiveAction: string;
  /** Label for the "New folder" action in the New menu. */
  newFolderLabel: string;
  /** Label for the Download action. */
  downloadLabel: string;
  /** Overlay label shown while a download is in progress. */
  downloadingLabel: string;
  /** Label for the Delete action. */
  deleteLabel: string;
  /** Overlay label shown while a delete operation is in progress. */
  deletingLabel: string;
  /** Label for the Rename action. */
  renameLabel: string;
  /** Overlay label shown while a rename operation is in progress. */
  renamingLabel: string;
  /** Label for the Copy action. */
  copyLabel: string;
  /** Label for the Move action. */
  moveLabel: string;
  /** Label for the Duplicate action. */
  duplicateLabel: string;
  /** Label for the "Add folder" button in the destination picker. */
  addFolderLabel: string;
  /** Label for the hidden-files toggle in the destination-folder picker. */
  hiddenFilesSwitcherLabel: string;
  /** Returns the header for the copy destination popup. */
  getCopyHeader: (count: number, name?: string) => string;
  /** Returns the header for the move destination popup. */
  getMoveHeader: (count: number, name?: string) => string;
  /** Tooltip shown on the disabled source folder in the destination picker. */
  moveSourceDisabledTooltip: string;
  /** Tooltip shown when a destination folder is still loading. */
  folderPickerLoadingTooltip: string;
  /** Empty-state title in the destination-folder picker. */
  folderPickerEmptyStateTitle: string;
  /** Empty-state description in the destination-folder picker. */
  folderPickerEmptyStateDescription: string;
  /** Overlay text shown during a copy operation. */
  copyingLabel: string;
  /** Overlay text shown during a move operation. */
  movingLabel: string;
  /** Title for the copy operation loader modal. */
  operationLoaderCopyTitle: string;
  /** Title for the move operation loader modal. */
  operationLoaderMoveTitle: string;
  /** Cancel-button label in the operation loader modal. */
  operationLoaderCancelLabel: string;
  /** Returns the delete confirmation dialog title for the given item names. */
  deleteConfirmTitle: (names: string[]) => ReactNode;
  /** Returns the delete confirmation dialog body for the given item names. */
  deleteConfirmBody: (names: string[]) => ReactNode;
  /** Confirm-button label in the delete confirmation dialog. */
  deleteConfirmLabel: string;
  /** Cancel-button label in the delete confirmation dialog. */
  deleteCancelLabel: string;
  /** Returns the upload queue heading for the number of files in it (e.g. "Uploading 5 files"). */
  getUploadQueueTitle: (count: number) => string;
  /** Translated strings for the upload `TransferQueue`; unset ones fall back to the kit's English defaults. */
  uploadQueueLabels?: Partial<TransferQueueLabels>;
  /** Empty-state title when a search yields no results. */
  searchEmptyStateTitle: string;
  /** Empty-state title for an empty subfolder. */
  folderEmptyStateTitle: string;
  /** Tooltip explaining which symbols are forbidden in file names. */
  forbiddenSymbolsTooltip: string;
  /** Per-tab empty-state title and description. */
  emptyStateByTab: Record<DialFileManagerTabs, EmptyStateCopy>;
  /** Per-tab tree header label. */
  treeHeaderByTab: Record<DialFileManagerTabs, string>;
  /** Messages for inline rename validation. */
  renameValidationMessages: RenameValidationMessages;
  /** Options for the conflict resolution popup. */
  conflictResolutionPopupOptions: ConflictResolutionPopupOptions;
  /** Label for the Unshare action. */
  unshareLabel: string;
  /** Overlay label shown while an unshare operation is in progress. */
  unsharingLabel: string;
  /** Label for the Remove Access action. */
  removeAccessLabel: string;
  /** Overlay label shown while a remove-access operation is in progress. */
  removingAccessLabel: string;
  /** Label for the Info action. */
  infoLabel: string;
  /** Header for the metadata popup. */
  metadataHeader: string;
  /** Label for the file name in the metadata popup. */
  metadataNameLabel: string;
  /** Label for the file path in the metadata popup. */
  metadataPathLabel: string;
  /** Label for the modified date in the metadata popup. */
  metadataModifiedDateLabel: string;
  /** Label for the file size in the metadata popup. */
  metadataSizeLabel: string;
  /** Label for the author in the metadata popup. */
  metadataAuthorLabel: string;
}

/**
 * Labels for `FileManagerAttachModal`. Extends the shell labels with
 * attach-specific strings.
 *
 * Declared here rather than beside the component so a host can type its label
 * object from this package's root entry without reaching the `./file-manager`
 * entry, which is the one that pulls in the grid.
 */
export interface FileManagerAttachModalLabels extends DialFileManagerShellLabels {
  /** Title displayed in the Popup header. */
  title: string;
  /** Label for the primary Attach button. */
  attachLabel: string;
  /** Optional subtitle shown below the title (e.g. allowed types / size). Pass `null` to hide. */
  headerDescription?: string | null;
}

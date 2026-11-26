/*
 * `DialFileManager` is imported as a type: it is used only inside
 * `typeof`/`ComponentProps` type queries, and a value import here would put
 * the grid in the closure of this package's root entry, which every host
 * reaches (see the note in `./index.ts`).
 */
import type {
  DialFile,
  DialFileManager,
  DialFileManagerTabs,
} from '@epam/ai-dial-react-file-manager';
import type { TransferQueueLabels } from '@epam/ai-dial-ui-kit';
import type { ComponentProps, ReactNode } from 'react';
import type { FileUploadFailureReason } from './upload-batch';

type DialFileManagerComponentProps = ComponentProps<typeof DialFileManager>;

/** Options for the conflict-resolution popup shown during copy/move operations. */
export type ConflictResolutionPopupOptions = NonNullable<
  DialFileManagerComponentProps['conflictResolutionPopupOptions']
>;

/** Validation messages shown during inline rename editing. */
export type RenameValidationMessages = NonNullable<
  DialFileManagerComponentProps['renameValidationMessages']
>;

/** Secondary text of the Copy/Move destination side panel; an unset field keeps the file manager package's English default. */
export interface FileManagerDestinationPanelTexts {
  /** Label of the panel's Cancel button. */
  cancelLabel?: string;
  /** Accessible name of the panel's close button. */
  closeAriaLabel?: string;
  /** Placeholder and accessible name of the folder search. */
  searchPlaceholder?: string;
  /** Accessible name of the search clear button. */
  clearSearchAriaLabel?: string;
  /** Message shown when a folder search matches nothing; `{query}` is replaced. */
  folderEmptyStateLabel?: string;
  /** Label of the action that cancels folder creation. */
  cancelCreatingFolderLabel?: string;
  /** Label of the context-menu action that creates a sibling folder. */
  addSiblingFolderLabel?: string;
  /** Label of the context-menu action that creates a child folder. */
  addChildFolderLabel?: string;
  /** Inline error for an empty new folder name. */
  createFolderEmptyNameError?: string;
  /** Inline error for a new folder name with forbidden characters. */
  createFolderInvalidNameError?: string;
  /** Inline error for a new folder name that duplicates a sibling. */
  createFolderDuplicateNameError?: string;
  /** Inline error for a new folder named like its parent folder. */
  createFolderSameAsParentNameError?: string;
  /** Notice for a new folder name starting with a dot, which hides the folder. */
  createFolderHiddenNameWarning?: string;
  /** Label of the action that retries a failed folder listing. */
  retryLabel?: string;
  /** Error announced when creating a folder fails. */
  createFolderFailedMessage?: string;
}

/** Text of the Copy/Move destination side panel. */
export interface FileManagerDestinationPanelLabels extends FileManagerDestinationPanelTexts {
  /** Returns the Copy panel title for `count` items; `isFolder` is true for a single folder. */
  getCopyTitle: (count: number, isFolder: boolean) => string;
  /** Returns the Move panel title for `count` items; `isFolder` is true for a single folder. */
  getMoveTitle: (count: number, isFolder: boolean) => string;
  /** Heading above the folder list for Copy. */
  copyHeading: string;
  /** Heading above the folder list for Move. */
  moveHeading: string;
  /** Label of the panel's Copy button. */
  copyButtonLabel: string;
  /** Label of the panel's Move button. */
  moveButtonLabel: string;
  /** Label of the folder-creation button. */
  addFolderLabel: string;
  /** Reason shown when Move targets the folder the items are already in. */
  sourceFolderTooltip: string;
  /** Reason shown when Move targets a moved folder or one inside it. */
  movedIntoItselfTooltip: string;
}

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
  /** Returns the text shown after the selection-count badge; the file manager renders the count itself, so omit it (e.g. "items selected"). */
  getSelectionLabel: (count: number) => string;
  /** Label for the "Upload files" action in the New menu. */
  uploadFilesLabel: string;
  /** Label for the "Upload archive" action in the New menu. */
  uploadArchiveAction: string;
  /** Label for the "New folder" action in the New menu. */
  newFolderLabel: string;
  /** Label for the Download action. */
  downloadLabel: string;
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
  /** Secondary text of the Copy/Move destination panel (search, folder creation, retry); unset fields keep the file manager's English defaults. */
  destinationPanelTexts?: FileManagerDestinationPanelTexts;
  /** Returns the Copy destination panel title for `count` items; `isFolder` is true for a single folder. */
  getCopyDestinationTitle: (count: number, isFolder: boolean) => string;
  /** Returns the Move destination panel title for `count` items; `isFolder` is true for a single folder. */
  getMoveDestinationTitle: (count: number, isFolder: boolean) => string;
  /** Heading above the folder list in the Copy destination panel. */
  copyDestinationHeading: string;
  /** Heading above the folder list in the Move destination panel. */
  moveDestinationHeading: string;
  /** Label of the Copy button in the destination panel. */
  copyDestinationButton: string;
  /** Label of the Move button in the destination panel. */
  moveDestinationButton: string;
  /** Tooltip shown on the disabled source folder in the destination picker. */
  moveSourceDisabledTooltip: string;
  /** Tooltip shown when the move destination is a moved folder or lies inside one. */
  movedIntoItselfTooltip: string;
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
  /** Returns the delete confirmation dialog title for the given item names and items; the items carry `nodeType`, so a folder and a file can be titled differently. */
  deleteConfirmTitle: (names: string[], items: DialFile[]) => ReactNode;
  /** Returns the delete confirmation dialog body for the given item names. */
  deleteConfirmBody: (names: string[]) => ReactNode;
  /** Confirm-button label in the delete confirmation dialog. */
  deleteConfirmLabel: string;
  /** Cancel-button label in the delete confirmation dialog. */
  deleteCancelLabel: string;
  /** Accessible name of the delete confirmation dialog's close control. Unset falls back to the file manager's English default. */
  deleteCloseLabel?: string;
  /** Returns the upload queue heading for the number of files in it (e.g. "Uploading 5 files"). */
  getUploadQueueTitle: (count: number) => string;
  /** Translated strings for the upload `TransferQueue`; unset ones fall back to the kit's English defaults. */
  uploadQueueLabels?: Partial<TransferQueueLabels>;
  /** Tooltip and accessible name of a failed upload or download row, per failure reason; a reason without one shows `uploadQueueLabels.failedMessage`. */
  uploadFailureMessages?: Partial<Record<FileUploadFailureReason, string>>;
  /** Returns the transfer queue heading from the number of upload and download rows; unset falls back to `getUploadQueueTitle` with the total. */
  getTransferQueueTitle?: (counts: {
    uploads: number;
    downloads: number;
  }) => string;
  /** Download-row wording of the transfer queue (cancel and progress names, and the aggregate bar's name when only downloads run); unset ones use `uploadQueueLabels`. */
  downloadQueueLabels?: Partial<
    Pick<
      TransferQueueLabels,
      'cancelItemAriaLabel' | 'itemProgressAriaLabel' | 'queueProgressAriaLabel'
    >
  >;
  /** Accessible name of the queue's aggregate progress bar while uploads and downloads both run; unset uses `uploadQueueLabels.queueProgressAriaLabel`. */
  transferQueueProgressAriaLabel?: string;
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
  /** Optional title rendered above the tabs. Omitted by default, so the tabs stand alone; the per-tab label above is then only used as the tabs' aria-label. */
  treeHeader?: string;
  /** Search field placeholder per source tab of the browsed folder; a tab without an entry keeps the file manager's default. */
  searchPlaceholderByTab?: Partial<Record<DialFileManagerTabs, string>>;
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
  /** Label for the Preview action. Omit to hide the action. */
  previewLabel?: string;
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
  /** Sort button name and menu labels; omitted, the file manager's English defaults apply. */
  sort?: DialFileManagerShellSortLabels;
}

/** Labels of the file manager's icon-only sort button and its menu. */
export interface DialFileManagerShellSortLabels {
  /** Accessible name and tooltip of the sort button, e.g. "Sort". */
  label: string;
  /** Menu labels of the sort fields. */
  fieldLabels: {
    /** "Name" field. */
    name: string;
    /** "Modified date" field. */
    updatedAt: string;
    /** "Size" field. */
    size: string;
  };
  /** Menu labels of the sort directions. */
  directionLabels: {
    /** "Ascending" direction. */
    asc: string;
    /** "Descending" direction. */
    desc: string;
  };
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

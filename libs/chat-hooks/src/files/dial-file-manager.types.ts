import type {
  DialCopiedItem,
  DialDeletedItem,
  DialFile,
  DialFileManagerActions,
  DialFileManagerTabs,
  DialUploadFileItem,
  FileManagerColumnKey,
} from '@epam/ai-dial-react-file-manager';
import type { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { DialFilesApi } from './dial-files-api';
import type { DownloadDestinationHandlers } from './download-destination';
import type {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from './file-manager-variant';
import type { FileUploadBatchState } from './upload-batch.types';

export interface FileUploadValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Library-owned identifier for why a file-manager hook is surfacing an
 * `onNotification` event, replacing a pre-translated toast message. The host
 * maps each reason to its own translated string.
 */
export enum FileManagerNotificationReason {
  /** A folder listing fetch (initial load, expand, invalidate-refetch, or popup preload) failed. */
  FolderLoadFailed = 'folderLoadFailed',
  /** A single-file/folder metadata fetch (`onGetInfo`) failed. */
  MetadataLoadFailed = 'metadataLoadFailed',
  /** `onCreateFolder`'s `createFolder` call failed. */
  FolderCreateFailed = 'folderCreateFailed',
  /** `onDownloadFiles` failed for a single file/folder selection. */
  DownloadFileFailed = 'downloadFileFailed',
  /** `onDownloadFiles` failed for a multi-item selection. */
  DownloadFilesFailed = 'downloadFilesFailed',
  /** `onDeleteFiles` deleted at least one item successfully; `count`/`name`/`folder` describe the result. */
  FilesDeleted = 'filesDeleted',
  /** `onDeleteFiles` completed with at least one failure alongside a success; `names`/`restCount` list the failures. */
  FilesDeletePartiallyFailed = 'filesDeletePartiallyFailed',
  /** `onDeleteFiles`'s `deleteFiles` request itself rejected. */
  DeleteFailed = 'deleteFailed',
  /** `onMoveToFiles`'s rename branch failed for every item in the batch. */
  RenameFailed = 'renameFailed',
  /** `onMoveToFiles`'s rename branch failed for some items; `count` is the failed count. */
  RenamePartiallyFailed = 'renamePartiallyFailed',
  /** `onMoveToFiles`'s move branch failed for every item in the batch. */
  MoveFailed = 'moveFailed',
  /** `onMoveToFiles`'s move branch failed for some items; `count` is the failed count. */
  MovePartiallyFailed = 'movePartiallyFailed',
  /** `onCopyFiles` failed for every item in the batch. */
  CopyFailed = 'copyFailed',
  /** `onCopyFiles` failed for some items; `count` is the failed count. */
  CopyPartiallyFailed = 'copyPartiallyFailed',
  /** `useDialFileSharing`'s `onUnshareFiles` request failed. */
  UnshareFailed = 'unshareFailed',
  /** `useDialFileSharing`'s `onRemoveFilesAccess` request failed. */
  RemoveAccessFailed = 'removeAccessFailed',
  /** `useDialFileUploadBatch`'s plain-file batch had zero successful uploads. */
  UploadFailed = 'uploadFailed',
  /** `useDialFileUploadBatch`'s plain-file batch completed (fully or partially successful). */
  UploadCompleted = 'uploadCompleted',
  /** `onUploadArchive` extracted zero entries successfully; `names`/`restCount` list the failures. */
  UploadArchiveFailed = 'uploadArchiveFailed',
  /** `onUploadArchive` extracted some entries successfully and some failed; `count`/`names`/`restCount` describe the failures. */
  UploadArchivePartiallyFailed = 'uploadArchivePartiallyFailed',
  /** `onUploadArchive`'s `uploadArchive` request itself rejected. */
  UploadArchiveRequestFailed = 'uploadArchiveRequestFailed',
}

/**
 * Structured toast event emitted by file-manager hooks. `reason` carries a
 * library-owned identifier the host translates; `message` is an optional
 * pre-rendered fallback for notifications a hook composes without a `reason`
 * (e.g. hosts still authoring their own text for hooks not yet covered by a
 * `FileManagerNotificationReason` member). The remaining fields carry the
 * data a host needs to interpolate its translated string for reasons whose
 * wording depends on more than the reason itself.
 */
export interface FileManagerNotification {
  variant: NotificationVariant;
  title?: string;
  message?: string;
  reason?: FileManagerNotificationReason;
  /** Number of items the notification covers (e.g. a partial-failure count). */
  count?: number;
  /** Name of the affected entity or first successfully affected item. */
  name?: string;
  /** Source or destination folder name the notification refers to. */
  folder?: string;
  /** Up to the first 5 names affected by a partial/full failure list (e.g. archive extraction, delete). */
  names?: string[];
  /** Count of additional affected items beyond `names`' limit. */
  restCount?: number;
}

/**
 * Reason a file/folder name failed `onCreateFolderValidate`/
 * `onRenameValidate`'s validation, used as the discriminant of
 * `FileNameValidationError`.
 */
export enum FileNameValidationErrorReason {
  Empty = 'empty',
  ForbiddenSymbols = 'forbiddenSymbols',
  ReservedName = 'reservedName',
  TooLong = 'tooLong',
  DuplicateName = 'duplicateName',
  LeadingDot = 'leadingDot',
}

/**
 * Discriminated validation failure returned by `onCreateFolderValidate`/
 * `onRenameValidate` instead of a pre-translated message; `null` means the
 * name is valid. The host maps each `reason` to its own translated string.
 */
export type FileNameValidationError =
  | { reason: FileNameValidationErrorReason.Empty }
  | {
      reason: FileNameValidationErrorReason.ForbiddenSymbols;
      symbols: string;
    }
  | { reason: FileNameValidationErrorReason.ReservedName }
  | { reason: FileNameValidationErrorReason.TooLong; maxLength: number }
  | {
      reason: FileNameValidationErrorReason.DuplicateName;
      existingName: string;
    }
  | { reason: FileNameValidationErrorReason.LeadingDot };

/**
 * Kind of mutation `useDialFileMutations` just completed successfully, for
 * `onOperationSuccess`. Delete has no member here — its success feedback
 * stays a structured `onNotification` event since it needs a count/folder,
 * not a single named entity.
 */
export enum FileOperationKind {
  FolderCreated = 'folderCreated',
  FileRenamed = 'fileRenamed',
  FileDownloaded = 'fileDownloaded',
  FilesDownloaded = 'filesDownloaded',
  FileCopied = 'fileCopied',
  FilesCopied = 'filesCopied',
  FileMoved = 'fileMoved',
  FilesMoved = 'filesMoved',
}

/**
 * Structured success event `useDialFileMutations` emits through
 * `onOperationSuccess` instead of calling an application notification
 * service directly.
 */
export interface FileOperationSuccessEvent {
  /** Which mutation just succeeded. */
  kind: FileOperationKind;
  /** Name of the affected entity or first successfully affected item, when applicable. */
  name?: string;
  /** Number of items the operation covered, when applicable. */
  count?: number;
  /** Destination folder name, for copy/move operations. */
  destinationFolderName?: string;
  /**
   * Whether the affected item is a folder rather than a file. Only set for
   * `fileRenamed`, since it is the only kind whose current wording depends
   * on the item's node type (a rename toast reads "Folder renamed" vs.
   * "File renamed").
   */
  isFolder?: boolean;
}

export interface UseDialFileManagerOptions {
  /** Injected operation port used for every file-manager network call. */
  filesApi: DialFilesApi;
  /** DIAL Core bucket to browse (used only for my_files tab). */
  bucket: string;
  /** Display name for the root folder node. Defaults to `'My files'`. */
  rootLabel?: string;
  /** Active tab — drives listing source and per-tab options. Defaults to MyFiles. */
  activeTab?: DialFileManagerTabs;
  /** Called when a file-manager action should surface a toast notification. */
  onNotification?: (notification: FileManagerNotification) => void;
  /** Called when a mutation succeeds, instead of invoking an application notification service directly. */
  onOperationSuccess?: (event: FileOperationSuccessEvent) => void;
  /** Regexp of characters forbidden in file/folder names (e.g. NOT_ALLOWED_SYMBOLS_REGEXP). */
  forbiddenSymbolsRegExp?: RegExp;
  /** Which host is driving this hook instance. Defaults to `Attach`. */
  variant?: DialFileManagerVariant;
  /** Gates which actions are exposed. Defaults to the value derived from `variant`. */
  actionProfile?: DialFileManagerActionProfile;
  /**
   * Host-supplied action label text, keyed by `DialFileManagerActions`. The
   * hook computes which actions are visible/enabled per tab/variant/
   * actionProfile and intersects that gating with this map — an action the
   * gating allows but this map omits is left out of `actionLabels`.
   */
  labels: Partial<Record<DialFileManagerActions, string>>;
  /** BCP-47 locale string for date formatting, replacing `i18n.language`. */
  locale: string;
  /** Translated tooltip shown on the disabled New/Upload button. */
  disabledNewButtonTooltip: string;
  /** Host-injected browser "Save As"/auto-download seam for `onDownloadFiles`. */
  downloadDestination: DownloadDestinationHandlers;
  /**
   * Builds a translated message from a structured validation-error reason,
   * for `onCreateFolderValidate`/`onRenameValidate`. `item` is passed for a
   * rename (so the host can distinguish file vs. folder wording) and
   * omitted for folder creation.
   */
  buildValidationErrorMessage: (
    error: FileNameValidationError,
    item?: DialFile,
  ) => string;
}

export interface UseDialFileManagerResult {
  /** Hierarchical items for DialFileManager's `items` prop. */
  items: DialFile[];
  /** True while the current folder is loading. */
  isLoading: boolean;
  /** Non-null when the last fetch failed. */
  error: string | null;
  /** Current path in DialFileManager format (e.g. `"/My files"`, `"/My files/reports/"`). */
  path: string;
  /** Pass directly to DialFileManager's `onPathChange`. */
  onPathChange: (nextPath?: string) => void;
  /** Re-runs the fetch for the current `folderPath`. */
  retry: () => void;

  /**
   * Search: called by DialFileManager when the user types in the search box.
   * `folder` is accepted for API parity with DialFileManager but is intentionally
   * unused — this hook always searches from the active-tab root stored in
   * `folderPath`, not from the passed-in `folder` (see design decision D3).
   */
  onSearchFiles: (folder: string, query: string) => void;
  /** Search: true while a search request is in flight. */
  isSearching: boolean;
  /** Search: flat list of matching files, or null when search is not active. */
  searchResults: DialFile[] | null;
  /** Search: clears results and exits search mode. */
  clearSearchResults: () => void;

  /** Tree: controlled set of expanded folder virtual paths. */
  expandedPaths: Set<string>;
  /** Tree: expanded or destination-popup virtual paths whose children are already cached. */
  loadedPaths: Set<string>;
  /** Tree: called by DialFileManager when a folder is expanded/collapsed. */
  onExpandedPathsChange: (paths: Set<string>) => void;
  /** Destination folder popup: preloads the browsed folder without changing the outer grid path. */
  onFolderPopupPathChange: (nextPath?: string) => void;
  /** Destination folder popup: normalized virtual paths currently being preloaded. */
  folderPopupLoadingPaths: Set<string>;

  /** Upload: start a new batch. */
  onUploadFiles: (
    files: DialUploadFileItem[],
    destinationFolder: string,
  ) => void;
  /** Upload: extracts and uploads a ZIP archive's entries to the destination folder. */
  onUploadArchive: (
    file: File,
    name: string,
    destinationFolder: string,
  ) => void;
  /** Upload: validate file names before upload (called by DialFileManager). */
  onValidateUpload: (
    files: DialUploadFileItem[],
    existingFiles: DialFile[],
    destinationFolder: string,
  ) => Promise<FileUploadValidationResult>;
  /** Upload: current batch state (null when idle). */
  uploadBatchState: FileUploadBatchState | null;
  /** Upload: abort all in-flight and queued uploads. */
  cancelUpload: () => void;
  /** Upload: dismiss the progress modal after the batch has settled. */
  clearUploadBatch: () => void;

  /** Folder creation: called when user confirms a new folder name. */
  onCreateFolder: (
    file: DialUploadFileItem,
    folderPath: string,
    fileId: string,
  ) => Promise<void>;
  /** Folder creation: inline synchronous validation (returns error message or null). */
  onCreateFolderValidate: (
    name: string,
    parentFolder: DialFile,
  ) => string | null;
  /** True while a folder creation request is in flight. */
  isCreatingFolder: boolean;

  /** Download: called when user triggers download on one or more items. */
  onDownloadFiles: (dialFiles: DialFile[]) => void;
  /** True while a download is in progress. */
  isDownloading: boolean;

  /** Delete: called when user confirms deletion of one or more items. */
  onDeleteFiles: (items: DialDeletedItem[], sourceFolder: string) => void;
  /** True while a delete request is in flight. */
  isDeleting: boolean;

  /** Rename: inline validation — returns error string or null. */
  onRenameValidate: (value: string, item: DialFile) => string | null;
  /** Rename: called when user confirms an inline rename. Also dispatches cross-folder move (see D3). */
  onMoveToFiles: (
    items: DialCopiedItem[],
    sourceFolder: string,
    destinationFolder: string,
  ) => void;
  /** True while a rename request is in flight. */
  isRenaming: boolean;

  /** Copy: called when user confirms a copy-paste. */
  onCopyFiles: (items: DialCopiedItem[], destinationFolder: string) => void;
  /** True while a copy request is in flight. */
  isCopying: boolean;
  /** True while the cross-folder-move branch of onMoveToFiles is in flight. */
  isMoving: boolean;
  /** Aborts whichever of copy/move is currently in flight. */
  cancelCopyMove: () => void;

  /** True when the current folder grants WRITE (upload + new folder). */
  uploadEnabled: boolean;
  /** True when Upload/New must be disabled. */
  isNewButtonDisabled: boolean;
  /** Tooltip for disabled New/Upload when `isNewButtonDisabled` is true. */
  disabledNewButtonTooltip: string;

  /** Columns to show in the grid — tab-dependent. */
  visibleColumns: FileManagerColumnKey[];
  /** BCP-47 locale string for date formatting, sourced from i18n.language. */
  dateLocale: string;
  /** Fixed date format options for the UpdatedAt column. */
  dateOptions: Intl.DateTimeFormatOptions;
  /** Action labels for grid/tree/bulk — Delete present only on my_files tab. */
  actionLabels: Partial<Record<DialFileManagerActions, string>>;
  /** Root-level shared item paths, populated only on the Shared tab. */
  sharedWithMeIds: string[] | undefined;

  /** Share: paths the user has shared with others, populated only on my_files tab. */
  sharedByMePaths: Set<string>;

  /** Unshare: called when user removes a shared-with-me item (Shared tab only). */
  onUnshareFiles: (files: DialFile[]) => void;
  /** True while an unshare request is in flight. */
  isUnsharing: boolean;
  /** Remove access: called when user revokes access to an owned shared item (my_files tab only). */
  onRemoveFilesAccess: (files: DialFile[]) => void;
  /** True while a remove-access request is in flight. */
  isRemovingAccess: boolean;

  /** Metadata: populated once onGetInfo resolves; passed to fileMetadataPopupOptions.fileMetadata. */
  fileMetadata: DialFile | undefined;
  /** True while a metadata request is in flight. */
  isFileMetadataLoading: boolean;
  /** Metadata: called by DialFileManager.onGetInfo to fetch and display a file's details. */
  onGetInfo: (file: DialFile) => void;
  /** Metadata: resets fileMetadata/isFileMetadataLoading; passed to fileMetadataPopupOptions.clearMetadata. */
  clearMetadata: () => void;

  /**
   * True while any mutating file-manager operation is in flight: the OR of
   * `isCreatingFolder`, `isDownloading`, `isDeleting`, `isRenaming`, `isCopying`,
   * `isMoving`, `isUnsharing`, `isRemovingAccess`, and `uploadBatchState != null`.
   *
   * Deliberately excludes three flags, each already fully contained by its own
   * scoped loading UI:
   * - `isLoading` — a read (listing fetch), not a mutation.
   * - `isSearching` — scoped to ui-kit's own search-progress UI.
   * - `isFileMetadataLoading` — has its own `loading` state in `fileMetadataPopupOptions`.
   */
  isAnyOperationInProgress: boolean;
}

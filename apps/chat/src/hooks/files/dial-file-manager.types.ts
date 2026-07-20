import type {
  DialCopiedItem,
  DialDeletedItem,
  DialFile,
  DialFileManagerActions,
  DialFileManagerTabs,
  DialUploadFileItem,
  FileManagerColumnKey,
  NotificationVariant,
} from '@epam/ai-dial-ui-kit';
import type { ShareFilesDtoPermissionEnum } from '@epam/chat-api-client';
import type { FileUploadBatchState } from '../../components/DialFileManagerModal/types/upload';
import type {
  DialFileManagerActionProfile,
  DialFileManagerVariant,
} from '../../types/file-manager-variant';
import type { ShareTarget } from './useDialFileSharing';

export interface FileUploadValidationResult {
  valid: boolean;
  message?: string;
}

export interface FileManagerNotification {
  variant: NotificationVariant;
  title?: string;
  message: string;
}

export interface UseDialFileManagerOptions {
  /** DIAL Core bucket to browse (used only for my_files tab). */
  bucket: string;
  /** Display name for the root folder node. Defaults to `'My files'`. */
  rootLabel?: string;
  /** Active tab — drives listing source and per-tab options. Defaults to MyFiles. */
  activeTab?: DialFileManagerTabs;
  /** Called when a file-manager action should surface a toast notification. */
  onNotification?: (notification: FileManagerNotification) => void;
  /** Regexp of characters forbidden in file/folder names (e.g. NOT_ALLOWED_SYMBOLS_REGEXP). */
  forbiddenSymbolsRegExp?: RegExp;
  /** Which host is driving this hook instance. Defaults to `Attach`. */
  variant?: DialFileManagerVariant;
  /** Gates which actions are exposed. Defaults to the value derived from `variant`. */
  actionProfile?: DialFileManagerActionProfile;
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
  /** Tree: virtual paths whose children are already in the cache (derived). */
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
  /** Share: non-null while ShareFileModal should be open. */
  shareTarget: ShareTarget | null;
  /** Share: called by DialFileManager.onManagePermissions to open the modal for `path`. */
  onManagePermissions: (path?: string) => void;
  /** Share: closes ShareFileModal, clearing `shareTarget`. */
  onCloseShareModal: () => void;
  /** Share: called by ShareFileModal to create the invitation link; throws on failure. */
  onCreateShareLink: (
    permission: ShareFilesDtoPermissionEnum,
  ) => Promise<string>;
  /** True while a share request is in flight. */
  isSharing: boolean;

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
   * Deliberately excludes four flags, each already fully contained by its own
   * scoped loading UI:
   * - `isLoading` — a read (listing fetch), not a mutation.
   * - `isSearching` — scoped to ui-kit's own search-progress UI.
   * - `isFileMetadataLoading` — has its own `loading` state in `fileMetadataPopupOptions`.
   * - `isSharing` — already blocked by `ShareFileModal`'s own foreground `DialPopup`.
   */
  isAnyOperationInProgress: boolean;
}

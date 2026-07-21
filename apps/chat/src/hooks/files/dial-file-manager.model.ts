import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';
import { DialFilePermission, FileManagerColumnKey } from '@epam/ai-dial-ui-kit';

/** Max number of files uploaded concurrently within a single upload batch. */
export const UPLOAD_CONCURRENCY = 3;

/** Name reserved for the hidden marker file used to create empty folders. */
export const RESERVED_MARKER_NAME = HIDDEN_FILE;

export const PATH_SEPARATOR_REGEXP = /[/\\]/;

export const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
};

export const COLUMNS_WITHOUT_AUTHOR: FileManagerColumnKey[] = [
  FileManagerColumnKey.Name,
  FileManagerColumnKey.UpdatedAt,
  FileManagerColumnKey.Size,
  FileManagerColumnKey.Actions,
];

export const COLUMNS_WITH_AUTHOR: FileManagerColumnKey[] = [
  FileManagerColumnKey.Name,
  FileManagerColumnKey.UpdatedAt,
  FileManagerColumnKey.Size,
  FileManagerColumnKey.Author,
  FileManagerColumnKey.Actions,
];

export const CORE_PERMISSION_MAP: Record<string, DialFilePermission> = {
  READ: DialFilePermission.READ,
  WRITE: DialFilePermission.WRITE,
  SHARE: DialFilePermission.SHARE,
};

/** Owner-bucket resolution metadata for a Shared-tab root folder, keyed by its display name. */
export interface SharedRootMeta {
  bucket: string;
  /** DIAL Core URL of the shared root item, e.g. "files/owner-bucket/some-folder/" */
  dialCorePath: string;
}

export interface PreparedCopyMoveItem<TDto> {
  dto: TDto;
  destinationName: string;
}

export interface CopyMoveResult {
  success?: boolean;
  sourcePath?: string;
  destinationPath?: string;
}

import { HttpException, HttpStatus } from '@nestjs/common';
import { StringUtils } from '../../common/utils/string-utils';

export interface ArchiveEntryPathResult {
  isDirectory: boolean;
  safeRelativePath: string | null;
}

const DIAL_RESOURCE_SEGMENT_BYTE_LIMIT = 255;

export const ARCHIVE_ENTRY_CONFLICT_RETRY_LIMIT = 50;

const splitFilePath = (
  path: string,
): { parentPath: string; fileName: string } => {
  const slashIndex = path.lastIndexOf('/');
  if (slashIndex === -1) {
    return { parentPath: '', fileName: path };
  }

  return {
    parentPath: path.slice(0, slashIndex + 1),
    fileName: path.slice(slashIndex + 1),
  };
};

const buildDeduplicatedFileName = (fileName: string, index: number): string => {
  const dotIndex = fileName.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const baseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const extension = hasExtension ? fileName.slice(dotIndex) : '';
  const suffix = ` (${index})`;
  const suffixBytes = StringUtils.getUtf8ByteLength(suffix);
  const extensionLimit = Math.max(
    0,
    DIAL_RESOURCE_SEGMENT_BYTE_LIMIT - suffixBytes - 1,
  );
  const safeExtension = StringUtils.truncateToUtf8Bytes(
    extension,
    extensionLimit,
  );
  const baseLimit = Math.max(
    1,
    DIAL_RESOURCE_SEGMENT_BYTE_LIMIT -
      suffixBytes -
      StringUtils.getUtf8ByteLength(safeExtension),
  );
  const safeBase =
    StringUtils.truncateToUtf8Bytes(baseName, baseLimit).trimEnd() ||
    StringUtils.truncateToUtf8Bytes('file', baseLimit);

  return `${safeBase}${suffix}${safeExtension}`;
};

/** `path` with ` (index)` before the extension of its last segment, kept within DIAL Core's 255-byte segment limit. */
export const buildDeduplicatedFilePath = (
  path: string,
  index: number,
): string => {
  const { parentPath, fileName } = splitFilePath(path);
  return `${parentPath}${buildDeduplicatedFileName(fileName, index)}`;
};

export const isConflictError = (err: unknown): boolean =>
  err instanceof HttpException && err.getStatus() === HttpStatus.CONFLICT;

/** Per-entry error text recorded in an archive upload result. */
export const getArchiveEntryUploadError = (err: unknown): string => {
  if (isConflictError(err)) {
    return 'Conflict';
  }

  return err instanceof HttpException ? err.message : 'Upload failed';
};

/** Decodes a yauzl entry name read with `decodeStrings: false` (raw `Buffer`), or passes a string through unchanged. */
export const decodeArchiveEntryName = (rawFileName: string): string => {
  const raw: unknown = rawFileName;
  return Buffer.isBuffer(raw) ? raw.toString('utf8') : rawFileName;
};

/**
 * Zip-slip defense for an uploaded archive entry (D4): rejects absolute
 * paths, drive letters, `..` segments, and backslashes. Directory entries
 * (trailing `/`) are flagged so callers can skip them silently rather than
 * treat them as a failed result.
 */
export const resolveArchiveEntryPath = (
  entryFileName: string,
): ArchiveEntryPathResult => {
  if (entryFileName.endsWith('/')) {
    return { isDirectory: true, safeRelativePath: null };
  }

  const isUnsafe =
    entryFileName === '' ||
    entryFileName.startsWith('/') ||
    /^[a-zA-Z]:/.test(entryFileName) ||
    entryFileName.includes('\\') ||
    entryFileName.split('/').some((seg) => seg === '..' || seg === '.');

  return {
    isDirectory: false,
    safeRelativePath: isUnsafe ? null : entryFileName,
  };
};

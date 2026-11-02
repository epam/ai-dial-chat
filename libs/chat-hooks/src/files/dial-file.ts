import { DialFileNodeType, type DialFile } from '@epam/ai-dial-ui-kit';
import { safeDecodeURI } from '../shared/string-utils';

/** True when `url` looks like a DIAL Core file id (`files/{bucket}/{path}`). */
export const isDialFileId = (url: string): boolean => url.startsWith('files/');

/** True when `url` is a DIAL Core folder id: a file id ending with `/`, ignoring any `#...` fragment. */
export const isDialFolderId = (url: string): boolean =>
  isDialFileId(url) && url.split('#')[0].endsWith('/');

/**
 * Converts a DIAL file ID or full resource path to the relative bucket path
 * expected by the files download API.
 */
export const resolveRelativeDialFilePath = (
  pathOrFileId: string,
  bucket: string,
): string => {
  const resourcePrefix = `files/${bucket}/`;
  if (pathOrFileId.startsWith(resourcePrefix)) {
    return safeDecodeURI(pathOrFileId.slice(resourcePrefix.length));
  }

  if (isDialFileId(pathOrFileId)) {
    const withoutPrefix = pathOrFileId.slice('files/'.length);
    const slashIdx = withoutPrefix.indexOf('/');
    if (slashIdx >= 0) {
      const pathBucket = withoutPrefix.slice(0, slashIdx);
      const rawPath = withoutPrefix.slice(slashIdx + 1);
      if (pathBucket === bucket) {
        return safeDecodeURI(rawPath);
      }
    }
  }

  return pathOrFileId;
};

/**
 * Extracts the bucket and decoded relative path from a DIAL file ID
 * (`files/{bucket}/{path}`). Returns `undefined` if the input does not start
 * with `files/` or has no path segment after the bucket.
 */
export const resolveDialFileBucketAndPath = (
  fileId: string,
): { bucket: string; path: string } | undefined => {
  if (!isDialFileId(fileId)) return undefined;
  const withoutPrefix = fileId.slice('files/'.length);
  const slashIdx = withoutPrefix.indexOf('/');
  if (slashIdx < 0) return undefined;
  const bucket = withoutPrefix.slice(0, slashIdx);
  const rawPath = withoutPrefix.slice(slashIdx + 1);
  let path: string;
  try {
    path = decodeURIComponent(rawPath);
  } catch {
    path = rawPath;
  }
  return { bucket, path };
};

/** What a file-manager selection consists of, for picking its confirmation copy. */
export enum FileSelectionKind {
  /** Exactly one file. */
  File = 'file',
  /** Exactly one folder. */
  Folder = 'folder',
  /** Zero or several items. */
  Multiple = 'multiple',
}

/** Returns whether a selection is one file, one folder or several items. */
export const getFileSelectionKind = (
  items: readonly Pick<DialFile, 'nodeType'>[],
): FileSelectionKind => {
  if (items.length !== 1) return FileSelectionKind.Multiple;
  return items[0].nodeType === DialFileNodeType.FOLDER
    ? FileSelectionKind.Folder
    : FileSelectionKind.File;
};

/**
 * Returns the DIAL folder path (`files/{bucket}/{path}/`) for a file-manager
 * folder, or `null` when it carries neither `url` nor `id`.
 */
export const resolveDialFolderPath = (
  file: Pick<DialFile, 'url' | 'id' | 'bucket'>,
  bucket: string,
): string | null => {
  const source = file.url ?? file.id ?? '';
  if (!source) return null;
  const dialPath = isDialFileId(source)
    ? source
    : `files/${file.bucket ?? bucket}/${source.replace(/^\/+/, '')}`;
  // Strip `../`/`./` segments before the path reaches DIAL Core; the BFF is the trust boundary, this guards against a compromised response.
  const normalizedDialPath = dialPath
    .split('/')
    .filter((segment) => segment !== '..' && segment !== '.')
    .join('/');
  return normalizedDialPath.endsWith('/')
    ? normalizedDialPath
    : `${normalizedDialPath}/`;
};

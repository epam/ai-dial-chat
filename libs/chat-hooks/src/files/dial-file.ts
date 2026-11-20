import { DialFileNodeType, type DialFile } from '@epam/ai-dial-ui-kit';
import { safeDecodeURI } from '../shared/string-utils';

/** True when `url` looks like a DIAL Core file id (`files/{bucket}/{path}`). */
export const isDialFileId = (url: string): boolean => url.startsWith('files/');

/**
 * True when `url` is a DIAL Core file id in `bucket` without a `..` segment, ignoring a query or fragment; a theme icon name, an absolute URL or a file in another bucket is `false`.
 * @param url - the stored value, e.g. an application's `iconUrl`
 * @param bucket - the bucket the file must lie in
 */
export const isOwnDialFileId = (url: string, bucket: string): boolean => {
  const [fileId] = url.split(/[?#]/, 1);
  if (!isDialFileId(fileId)) return false;
  const segments = safeDecodeURI(fileId).split('/');
  return !segments.includes('..') && segments[1] === safeDecodeURI(bucket);
};

const PROJECT_ID_PREFIX = 'projects/';
const PROJECT_FILES_SEGMENT = '/files/';

/** The decoded parts of a DIAL Core project file id, `projects/{bucket}/{path}/files/{filePath}`. */
export interface DialProjectFileIdParts {
  /** The project id, `projects/{bucket}/{path}`, with every segment decoded. */
  projectId: string;
  /** The decoded segments of the file path inside the project, e.g. `['artifacts', 'run-1', 'data.csv']`. */
  filePath: string[];
}

/* Decodes each `/`-separated segment; `undefined` on a malformed escape or an empty segment. */
const decodePathSegments = (path: string): string[] | undefined => {
  const segments: string[] = [];
  for (const segment of path.split('/')) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return undefined;
    }
    if (decoded === '') return undefined;
    segments.push(decoded);
  }
  return segments;
};

/**
 * Returns the decoded parts of a DIAL Core project file id, ignoring any
 * `#...` fragment, or `undefined` when `url` is not one: no `projects/`
 * prefix, no project path, a folder (trailing `/`), an empty segment or a
 * malformed escape.
 */
export const parseDialProjectFileId = (
  url: string,
): DialProjectFileIdParts | undefined => {
  const id = url.split('#')[0];
  if (!id.startsWith(PROJECT_ID_PREFIX)) return undefined;
  const bucketEnd = id.indexOf('/', PROJECT_ID_PREFIX.length);
  if (bucketEnd <= PROJECT_ID_PREFIX.length) return undefined;
  /* `files` is a name DIAL Core reserves, so no project path holds a `files`
   * segment and the first one always ends the project id. */
  const filesIndex = id.indexOf(PROJECT_FILES_SEGMENT, bucketEnd);
  if (filesIndex <= bucketEnd) return undefined;

  const projectSegments = decodePathSegments(
    id.slice(PROJECT_ID_PREFIX.length, filesIndex),
  );
  const filePath = decodePathSegments(
    id.slice(filesIndex + PROJECT_FILES_SEGMENT.length),
  );
  if (projectSegments == null || filePath == null) return undefined;
  return {
    projectId: `${PROJECT_ID_PREFIX}${projectSegments.join('/')}`,
    filePath,
  };
};

/** True when `url` is a DIAL Core id of a file inside a project, `projects/{bucket}/{path}/files/{filePath}`; see {@link parseDialProjectFileId}. */
export const isDialProjectFileId = (url: string): boolean =>
  parseDialProjectFileId(url) != null;

/** True when `url` is a DIAL Core file id (`files/…`) or a project file id (`projects/…/files/…`): an id the host resolves to one of its own download routes. */
export const isDialStoredFileId = (url: string): boolean =>
  isDialFileId(url) || isDialProjectFileId(url);

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

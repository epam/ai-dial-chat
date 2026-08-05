import type { DialFile } from '@epam/ai-dial-react-file-manager';
import {
  DialFileNodeType,
  DialFilePermission,
} from '@epam/ai-dial-react-file-manager';
import { DialFileManagerActionProfile } from '../../types/file-manager-variant';
import { safeDecodeURI } from '../../utils/string-utils';
import {
  PATH_SEPARATOR_REGEXP,
  type SharedRootMeta,
} from './dial-file-manager.model';

export const hasForbiddenNameSymbols = (
  name: string,
  forbiddenSymbolsRegExp?: RegExp,
): boolean => {
  if (PATH_SEPARATOR_REGEXP.test(name)) return true;
  if (forbiddenSymbolsRegExp == null) return false;

  forbiddenSymbolsRegExp.lastIndex = 0;
  const hasMatch = forbiddenSymbolsRegExp.test(name);
  forbiddenSymbolsRegExp.lastIndex = 0;
  return hasMatch;
};

export const normalizeVirtualPath = (value: string): string => {
  const trimmed = value.replace(/\/+$/, '');
  return trimmed || '/';
};

export const getVirtualPathName = (
  virtualPath: string,
  fallback: string,
): string => {
  const segments = virtualPath.split('/').filter(Boolean);
  return safeDecodeURI(segments[segments.length - 1] ?? fallback);
};

export const formatOperationFolderName = (
  destinationFolder: string,
  rootLabel: string,
): string =>
  normalizeVirtualPath(destinationFolder || `/${rootLabel}`).replace(
    /^\/+/,
    '',
  ) || rootLabel;

export const findFolderByVirtualPath = (
  nodes: DialFile[],
  virtualPath: string,
): DialFile | undefined => {
  const target = normalizeVirtualPath(virtualPath);
  for (const node of nodes) {
    if (node.nodeType !== DialFileNodeType.FOLDER) continue;
    if (normalizeVirtualPath(node.path) === target) return node;
    const nested = findFolderByVirtualPath(node.items ?? [], virtualPath);
    if (nested) return nested;
  }
  return undefined;
};

export const hasDialFileWritePermission = (folder?: DialFile): boolean =>
  folder?.permissions?.includes(DialFilePermission.WRITE) ?? false;

export const findDialFileByPath = (
  nodes: DialFile[],
  targetPath: string,
): DialFile | undefined => {
  for (const node of nodes) {
    if (node.path === targetPath || node.id === targetPath) return node;
    const nested = findDialFileByPath(node.items ?? [], targetPath);
    if (nested) return nested;
  }
  return undefined;
};

/** Copy/Move/Duplicate are Browse/Full-only — the attach picker excludes them. */
export const isCopyMoveDuplicateAllowed = (
  actionProfile: DialFileManagerActionProfile,
): boolean => {
  switch (actionProfile) {
    case DialFileManagerActionProfile.Attach:
      return false;
    case DialFileManagerActionProfile.Browse:
    case DialFileManagerActionProfile.Full:
      return true;
    default: {
      const exhaustiveCheck: never = actionProfile;
      throw new Error(`Unhandled actionProfile: ${String(exhaustiveCheck)}`);
    }
  }
};

/** Share/Unshare/Remove access are Full-only — Browse and Attach never expose them. */
export const isShareActionsAllowed = (
  actionProfile: DialFileManagerActionProfile,
): boolean => actionProfile === DialFileManagerActionProfile.Full;

export const parseNewFolderVirtualPath = (
  newFolderVirtualPath: string,
  rootLabel: string,
): { parentVirtualPath: string; name: string } => {
  const trimmed = newFolderVirtualPath.replace(/\/$/, '');
  const slashIndex = trimmed.lastIndexOf('/');

  if (slashIndex <= 0) {
    const name = slashIndex === 0 ? trimmed.slice(1) : trimmed;
    return { parentVirtualPath: `/${rootLabel}`, name };
  }

  return {
    parentVirtualPath: trimmed.slice(0, slashIndex),
    name: trimmed.slice(slashIndex + 1),
  };
};

/** Strip the "files/{bucket}/" prefix from a DIAL Core URL to get the path within the bucket. */
export const dialCorePathToRelative = (
  dialCorePath: string,
  bucket: string,
): string => {
  const prefix = `files/${bucket}/`;
  return dialCorePath.startsWith(prefix)
    ? dialCorePath.slice(prefix.length)
    : dialCorePath;
};

/**
 * Converts a bucket-relative path (e.g. "reports/q1.pdf") to the virtual
 * DialFile.path format ("/My files/reports/q1.pdf") that ui-kit compares
 * row items against for `sharedByMePaths`/`sharedWithMeIds` gating — the
 * DIAL Core resource path ("files/{bucket}/...") is a different identifier
 * space and never matches. Decodes each path segment independently, matching
 * how buildFromCache derives virtual paths.
 */
export const buildSharedItemVirtualPath = (
  relativePath: string,
  rootLabel: string,
  isFolder: boolean,
): string => {
  const trimmed = relativePath.replace(/\/+$/, '');
  const joined = trimmed
    .split('/')
    .filter(Boolean)
    .map(safeDecodeURI)
    .join('/');
  const base = joined ? `/${rootLabel}/${joined}` : `/${rootLabel}`;
  return isFolder ? `${base}/` : base;
};

/**
 * Resolves the effective bucket and path for a write operation on the Shared tab.
 * For Shared tab items, the first segment of apiPath is the shared root folder name
 * whose owner bucket is stored in sharedRootMeta.
 */
export const resolveOwnerCoords = (
  apiPath: string,
  sharedRootMeta: Map<string, SharedRootMeta>,
  fallbackBucket: string,
): { bucket: string; path: string } => {
  if (!apiPath) return { bucket: fallbackBucket, path: apiPath };
  const firstSlash = apiPath.indexOf('/');
  const sharedRootName =
    firstSlash === -1 ? apiPath : apiPath.slice(0, firstSlash);
  const meta = sharedRootMeta.get(sharedRootName);
  if (!meta) return { bucket: fallbackBucket, path: apiPath };
  const rootPathInBucket = dialCorePathToRelative(
    meta.dialCorePath,
    meta.bucket,
  );
  const subPath = firstSlash === -1 ? '' : apiPath.slice(firstSlash + 1);
  return { bucket: meta.bucket, path: rootPathInBucket + subPath };
};

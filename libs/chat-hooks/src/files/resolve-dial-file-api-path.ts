import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { DialFileNodeType } from '@epam/ai-dial-react-file-manager';
import { safeDecodeURI } from './string-utils';

/*
 * Local copy of `apps/chat/src/utils/dial-file.ts`'s `resolveRelativeDialFilePath`.
 * That app file has other unrelated consumers (e.g. attachment resolution), so
 * its export surface is not widened for this lib — this is a private,
 * behavior-identical duplicate scoped to file-manager path resolution only.
 */
const isDialFileId = (url: string): boolean => url.startsWith('files/');

const resolveRelativeDialFilePath = (
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
 * Converts a DialFileManager virtual path to an API folder path.
 * e.g. "/My files" → "", "/My files/reports/" → "reports/"
 */
export const virtualPathToApiPath = (
  virtualPath: string,
  rootLabel: string,
): string => {
  const rootExact = `/${rootLabel}`;
  const rootWithSlash = `/${rootLabel}/`;
  const labelWithSlash = `${rootLabel}/`;

  if (
    virtualPath === rootExact ||
    virtualPath === `${rootLabel}` ||
    virtualPath === rootWithSlash ||
    virtualPath === labelWithSlash
  ) {
    return '';
  }

  let stripped: string;
  if (virtualPath.startsWith(rootWithSlash)) {
    stripped = virtualPath.slice(rootWithSlash.length);
  } else if (virtualPath.startsWith(labelWithSlash)) {
    stripped = virtualPath.slice(labelWithSlash.length);
  } else {
    const withoutLeadingSlash = virtualPath.replace(/^\//, '');
    stripped = withoutLeadingSlash.startsWith(labelWithSlash)
      ? withoutLeadingSlash.slice(labelWithSlash.length)
      : withoutLeadingSlash;
  }

  /*
   * Collapse duplicate slashes (e.g. "folder//name") that ui-kit may produce
   * when concatenating paths, preventing BFF from forwarding malformed paths.
   */
  const collapsed = stripped.replace(/\/{2,}/g, '/');

  return collapsed && !collapsed.endsWith('/') ? `${collapsed}/` : collapsed;
};

/**
 * Returns the parent folder of a path (virtual or API), always trailing-slashed.
 * e.g. "reports/file.txt" -> "reports/", "/My files/reports/" -> "/My files/"
 */
export const getParentFolderPath = (path: string): string => {
  const normalized = path.replace(/\/$/, '');
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash > 0 ? normalized.slice(0, lastSlash + 1) : '';
};

const looksLikeVirtualDialPath = (path: string, rootLabel: string): boolean =>
  path.startsWith('/') ||
  path === rootLabel ||
  path.startsWith(`${rootLabel}/`);

/**
 * Resolves a DialFile to the bucket-relative API path used by files BFF endpoints.
 * Prefers DIAL resource ids when present; otherwise converts DialFile.path virtual paths.
 */
export const resolveDialFileApiPath = (
  file: DialFile,
  bucket: string,
  rootLabel: string,
): string => {
  const isFolder = file.nodeType === DialFileNodeType.FOLDER;
  const fromResourceId = file.id
    ? resolveRelativeDialFilePath(file.id, bucket)
    : null;
  const resourceIdLooksValid =
    fromResourceId != null &&
    !looksLikeVirtualDialPath(fromResourceId, rootLabel);

  const apiPath = resourceIdLooksValid
    ? fromResourceId
    : virtualPathToApiPath(file.path, rootLabel);

  if (isFolder) {
    return apiPath.endsWith('/') ? apiPath : `${apiPath}/`;
  }

  return apiPath.replace(/\/$/, '');
};

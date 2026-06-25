import type { DialFile } from '@epam/ai-dial-ui-kit';
import { DialFileNodeType } from '@epam/ai-dial-ui-kit';
import { resolveRelativeDialFilePath } from './dial-file';

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

  return stripped && !stripped.endsWith('/') ? `${stripped}/` : stripped;
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

import { MARKER_NAME } from './files.constants';
import type { DialFileItem } from './normalize-file-item';

const normalizeListedPath = (path: string): string =>
  path === '' || path.endsWith('/') ? path : `${path}/`;

export const getMarkerFolderPath = (
  item: Pick<DialFileItem, 'name' | 'url'>,
): string | null => {
  if (item.name !== MARKER_NAME) return null;

  const rawUrl = item.url ?? '';
  const suffix = `/${MARKER_NAME}`;
  if (!rawUrl.endsWith(suffix)) return null;

  const folderPath = rawUrl.slice(0, -suffix.length);
  return folderPath.endsWith('/') ? folderPath : `${folderPath}/`;
};

/** Folder-level permissions when Core attaches them to the marker item. */
export const resolveListingPermissions = (
  rawItems: DialFileItem[],
  listedPath: string,
): string[] | undefined => {
  const normalizedListed = normalizeListedPath(listedPath);

  for (const item of rawItems) {
    if (item.name !== MARKER_NAME || !item.permissions?.length) continue;

    const markerFolderPath = getMarkerFolderPath(item);
    if (markerFolderPath === normalizedListed) {
      return item.permissions;
    }
  }

  return undefined;
};

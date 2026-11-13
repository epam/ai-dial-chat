import type { OrgUnit } from '../models/org-unit';

/** The bucket segment every DIAL Core org-unit folder starts with. */
const PUBLIC_ROOT = 'public';

const safeDecode = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const toSegments = (path: string): string[] =>
  path.split('/').filter((segment) => segment !== '');

const joinFolder = (segments: readonly string[]): string =>
  segments.length === 0 ? '' : `${segments.join('/')}/`;

/**
 * Returns a unit's Core `folder` (url-encoded, rooted at `public/`, e.g.
 * `public/Acme/US%20Risk/`) as a decoded public-relative folder with one
 * trailing slash (`Acme/US Risk/`), or `''` for the public root and for a
 * folder outside `public/`.
 */
export const normalizeOrgUnitFolder = (folder: string): string => {
  const [root, ...segments] = toSegments(folder);
  if (root !== PUBLIC_ROOT) return '';
  return joinFolder(segments.map(safeDecode));
};

/** The normalised folders of `units`, for repeated {@link isOrgUnitFolder} lookups. */
export const toOrgUnitFolderSet = (
  units: readonly OrgUnit[],
): ReadonlySet<string> =>
  new Set(
    units
      .map(({ folder }) => normalizeOrgUnitFolder(folder))
      .filter((folder) => folder !== ''),
  );

/**
 * Whether `publicPath` — a decoded path relative to the public bucket, as the
 * file manager and the publish tree show it (`Acme/US Risk`) — is a unit's own
 * folder. A folder inside a unit is not a unit.
 */
export const isOrgUnitFolder = (
  unitFolders: ReadonlySet<string>,
  publicPath: string,
): boolean => {
  const folder = joinFolder(toSegments(publicPath));
  return folder !== '' && unitFolders.has(folder);
};

import { safeDecodeURIComponent } from '../common/utils/uri';
import type { OrgUnitDto } from './dto/org-unit.dto';

/**
 * Backend counterpart of the org-unit rights rule in
 * `libs/chat-shared/src/utils/org-unit.ts` (`normalizeOrgUnitFolder`,
 * `findOwningOrgUnit`, `canWriteAt`, `canWriteIntoOrgUnitAt`). chat-api cannot
 * import that lib, so the few rules both sides share are kept here and pinned
 * by tests that mirror the frontend's cases: change them together.
 */

const PUBLIC_ROOT = 'public';
const WRITE_ACTION = 'write';

/** The org-unit data a right is decided from. */
interface OrgUnitRightsData {
  hasAdminAccess: boolean;
  units: readonly OrgUnitDto[];
}

const toSegments = (path: string): string[] =>
  path.split('/').filter((segment) => segment !== '');

const joinFolder = (segments: readonly string[]): string =>
  segments.length === 0 ? '' : `${segments.join('/')}/`;

/**
 * A unit's Core `folder` (url-encoded, rooted at `public/`) as a decoded
 * public-relative folder with one trailing slash, or `''` for the public root
 * and for a folder outside `public/`.
 * @param folder - the unit's folder as DIAL Core returns it
 */
export const normalizeOrgUnitFolder = (folder: string): string => {
  const [root, ...segments] = toSegments(folder);
  if (root !== PUBLIC_ROOT) return '';
  return joinFolder(segments.map(safeDecodeURIComponent));
};

/**
 * The unit that owns `publicPath`: the one whose normalised folder is the
 * longest prefix of the path at a segment boundary. The public root and a
 * path under no listed unit have no owner.
 * @param units - units as returned by DIAL Core
 * @param publicPath - decoded path relative to the public bucket
 */
export const findOwningOrgUnit = (
  units: readonly OrgUnitDto[],
  publicPath: string,
): OrgUnitDto | undefined => {
  const pathFolder = joinFolder(toSegments(publicPath));
  if (pathFolder === '') return undefined;
  let owner: OrgUnitDto | undefined;
  let ownerLength = 0;
  for (const unit of units) {
    const folder = normalizeOrgUnitFolder(unit.folder);
    if (folder.length > ownerLength && pathFolder.startsWith(folder)) {
      owner = unit;
      ownerLength = folder.length;
    }
  }
  return owner;
};

/**
 * Whether the caller may write `namespace` at `publicPath`: a DIAL admin may
 * anywhere, otherwise the owning unit's `permissions` decide. A path under no
 * unit is `false` here; role names are never consulted.
 * @param data - the caller's org-unit data
 * @param publicPath - decoded public-relative path
 * @param namespace - Core namespace of the resource type
 */
export const canWriteAt = (
  data: OrgUnitRightsData,
  publicPath: string,
  namespace: string,
): boolean => {
  if (data.hasAdminAccess) return true;
  const owner = findOwningOrgUnit(data.units, publicPath);
  return owner?.permissions?.[namespace]?.includes(WRITE_ACTION) ?? false;
};

/**
 * Whether the caller may write straight into `publicPath`: the path lies
 * inside a listed unit and that unit (or admin access) grants `write`. A path
 * under no unit is `false` even for an admin.
 * @param data - the caller's org-unit data
 * @param publicPath - decoded public-relative path
 * @param namespace - Core namespace of the resource type
 */
export const canWriteIntoOrgUnitAt = (
  data: OrgUnitRightsData,
  publicPath: string,
  namespace: string,
): boolean =>
  findOwningOrgUnit(data.units, publicPath) != null &&
  canWriteAt(data, publicPath, namespace);

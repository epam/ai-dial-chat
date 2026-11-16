import {
  OrgUnitAction,
  type OrgUnit,
  type OrgUnitAccess,
  type OrgUnitNamespace,
} from '../models/org-unit';

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

/**
 * The unit that owns `publicPath`: the one whose normalised folder is the
 * longest prefix of the path at a segment boundary. A unit's own folder belongs
 * to it; the public root, a path under no listed unit and a sibling sharing
 * leading characters (`Risk2/` vs `Risk/`) have no owner. `publicPath` is the
 * decoded, public-relative path a tree shows and is not decoded again.
 * @param units - units as returned by DIAL Core
 * @param publicPath - decoded path relative to the public bucket, e.g. `Acme/US Risk/Reports`
 */
export const findOwningOrgUnit = (
  units: readonly OrgUnit[],
  publicPath: string,
): OrgUnit | undefined => {
  const pathFolder = joinFolder(toSegments(publicPath));
  if (pathFolder === '') return undefined;
  let owner: OrgUnit | undefined;
  let ownerLength = 0;
  for (const unit of units) {
    const unitFolder = normalizeOrgUnitFolder(unit.folder);
    if (unitFolder.length > ownerLength && pathFolder.startsWith(unitFolder)) {
      owner = unit;
      ownerLength = unitFolder.length;
    }
  }
  return owner;
};

/**
 * Whether the caller may do `action` on `namespace` at `publicPath`. A DIAL
 * admin may anywhere; otherwise only the owning unit's `permissions` decide, so
 * a path under no unit, a missing namespace or an empty list is `false`. Role
 * names are never consulted and `write` does not imply `read`.
 * @param access - resolved org-unit data
 * @param publicPath - decoded public-relative path
 * @param namespace - Core namespace of the resource type
 * @param action - the action asked about
 */
export const canAccessAt = (
  access: OrgUnitAccess,
  publicPath: string,
  namespace: OrgUnitNamespace,
  action: OrgUnitAction,
): boolean => {
  if (access.hasAdminAccess) return true;
  const owner = findOwningOrgUnit(access.units, publicPath);
  return owner?.permissions?.[namespace]?.includes(action) ?? false;
};

/** {@link canAccessAt} for the `write` action. */
export const canWriteAt = (
  access: OrgUnitAccess,
  publicPath: string,
  namespace: OrgUnitNamespace,
): boolean => canAccessAt(access, publicPath, namespace, OrgUnitAction.Write);

/**
 * Whether `publicPath` is a usable save destination: `true` for an admin and
 * for a path under no listed unit (the plain public folders keep today's
 * save-then-request flow), otherwise the owning unit must grant `write`.
 * Unlike {@link canWriteAt}, which is strict, a path outside every unit is not
 * refused here.
 * @param access - resolved org-unit data
 * @param publicPath - decoded public-relative path
 * @param namespace - Core namespace of the resource type
 */
export const canSaveToFolderAt = (
  access: OrgUnitAccess,
  publicPath: string,
  namespace: OrgUnitNamespace,
): boolean => {
  if (access.hasAdminAccess) return true;
  if (!findOwningOrgUnit(access.units, publicPath)) return true;
  return canWriteAt(access, publicPath, namespace);
};

/**
 * Whether the caller may write straight into `publicPath`: the path lies inside
 * a listed unit and that unit (or the caller's admin access) grants `write`.
 * Unlike {@link canSaveToFolderAt}, a path under no unit is `false` even for a
 * DIAL admin, so plain public folders keep the save-then-publish flow.
 * @param access - resolved org-unit data
 * @param publicPath - decoded public-relative path
 * @param namespace - Core namespace of the resource type
 */
export const canWriteIntoOrgUnitAt = (
  access: OrgUnitAccess,
  publicPath: string,
  namespace: OrgUnitNamespace,
): boolean =>
  findOwningOrgUnit(access.units, publicPath) != null &&
  canWriteAt(access, publicPath, namespace);

/** {@link canAccessAt} for the `read` action. */
export const canReadAt = (
  access: OrgUnitAccess,
  publicPath: string,
  namespace: OrgUnitNamespace,
): boolean => canAccessAt(access, publicPath, namespace, OrgUnitAction.Read);

/**
 * Whether a publication request into `publicPath` can be sent: `true` for an
 * admin and for a path under no listed unit (Core's folder rules decide there,
 * the client does not block), otherwise the owner must grant `read`.
 * @param access - resolved org-unit data
 * @param publicPath - decoded public-relative path
 * @param namespace - Core namespace of the resource type
 */
export const canRequestPublicationAt = (
  access: OrgUnitAccess,
  publicPath: string,
  namespace: OrgUnitNamespace,
): boolean => {
  if (access.hasAdminAccess) return true;
  if (!findOwningOrgUnit(access.units, publicPath)) return true;
  return canReadAt(access, publicPath, namespace);
};

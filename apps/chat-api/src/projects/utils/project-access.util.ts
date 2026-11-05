import type { components } from '@epam/ai-dial-typescript-sdk';
import { StringUtils } from '../../common/utils/string-utils';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { PUBLIC_BUCKET } from '../../constants/dial.constants';
import { ProjectSource } from '../dto/project-source.enum';

type SharedResourceMetadata = components['schemas']['MetadataBase'];

/** What the caller may do with one project. `canManage` implies `canEdit`. */
export interface ProjectAccess {
  /** May change the instructions and context files, and write the project's conversations. */
  canEdit: boolean;
  /** May rename, delete, share and publish the project. */
  canManage: boolean;
}

/** The DIAL Core permission that lets a share recipient write a project. */
export const PROJECT_WRITE_PERMISSION = 'WRITE';

/** The listing's source rule, applied to one project's bucket. */
export const resolveProjectSource = (
  bucket: string,
  sessionBucket: string,
): ProjectSource => {
  if (bucket === sessionBucket) return ProjectSource.Personal;
  if (bucket === PUBLIC_BUCKET) return ProjectSource.Organization;
  return ProjectSource.Shared;
};

/**
 * The permissions a share recipient holds on one project, from DIAL Core's
 * `getSharedResources({ with: 'me' })` entries. Each url is normalized as
 * `mapSharedProject` does (decoded, trailing `/` stripped). An entry counts
 * when it names the project itself or a grouping folder above it, because
 * Core unions a resource's permissions with its parents'
 * (`ShareService.lookupPermissions`). Requiring the `/` after a folder url
 * keeps a sibling with a common prefix (`research-old`) from matching
 * `research`.
 */
export const resolveSharedProjectPermissions = (
  resources: readonly SharedResourceMetadata[],
  projectId: string,
): ReadonlySet<string> => {
  const permissions = new Set<string>();
  for (const resource of resources) {
    if (resource.url == null) continue;
    const url = StringUtils.stripTrailingSlashes(
      safeDecodeURIComponent(resource.url),
    );
    if (url !== projectId && !projectId.startsWith(`${url}/`)) continue;
    for (const permission of resource.permissions ?? []) {
      permissions.add(permission);
    }
  }
  return permissions;
};

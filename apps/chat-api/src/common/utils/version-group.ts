import { RESOURCE_VERSION_SEPARATOR } from './next-free-path';
import { safeDecodeURIComponent } from './uri';

const MIN_RESOURCE_ID_SEGMENTS = 3;

/**
 * Identifies the versions of one resource saved in one folder: the decoded
 * folder path plus the base name, i.e. the last path segment without its
 * `__<version>` suffix. The key is built from the stored path, not from the
 * display name, so it survives a rename.
 * @param id - resource id such as `applications/{bucket}/{folder…}/{name}__{version}`
 * @returns the group key, or `undefined` when the id has no version suffix
 */
export const getVersionGroupId = (id: string): string | undefined => {
  const segments = id.split('/');
  if (segments.length < MIN_RESOURCE_ID_SEGMENTS) return undefined;

  const leaf = safeDecodeURIComponent(segments[segments.length - 1]);
  const separatorIndex = leaf.lastIndexOf(RESOURCE_VERSION_SEPARATOR);
  const hasVersion =
    separatorIndex > 0 &&
    separatorIndex + RESOURCE_VERSION_SEPARATOR.length < leaf.length;
  if (!hasVersion) return undefined;

  const folder = segments.slice(2, -1).map(safeDecodeURIComponent);
  return [...folder, leaf.slice(0, separatorIndex)].join('/');
};

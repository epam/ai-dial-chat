import { safeDecodeURIComponent } from '../../common/utils/uri';
import { PUBLIC_BUCKET } from '../../constants/dial.constants';
import {
  ResourceDependencyDto,
  ResourceDependencyType,
} from '../dto/resource-dependency.dto';

/** DIAL Core resource url prefix (first path segment) to the dependency kind it denotes. */
const DEPENDENCY_TYPE_BY_PREFIX: Record<string, ResourceDependencyType> = {
  applications: ResourceDependencyType.Application,
  toolsets: ResourceDependencyType.Toolset,
  prompts: ResourceDependencyType.Prompt,
  skills: ResourceDependencyType.Skill,
  files: ResourceDependencyType.File,
};

/** Kinds stored as `{name}__{version}`. */
const VERSIONED_TYPES = new Set([
  ResourceDependencyType.Application,
  ResourceDependencyType.Toolset,
]);

const VERSION_SEPARATOR = '__';

/** Legacy form of a folder attachment url: `metadata/` in front of the `files/` url. */
const LEGACY_METADATA_PREFIX = 'metadata/';

/**
 * Strips what a stored reference may carry besides the resource itself: a
 * `?query`, a `#fragment` and the legacy `metadata/` prefix.
 * @param resourceUrl - a reference as stored in an entity or a conversation
 */
const normalizeResourceUrl = (resourceUrl: string): string => {
  const withoutSuffix = resourceUrl.split(/[?#]/, 1)[0];
  return withoutSuffix.startsWith(LEGACY_METADATA_PREFIX)
    ? withoutSuffix.slice(LEGACY_METADATA_PREFIX.length)
    : withoutSuffix;
};

/**
 * Whether a resource url sits in `bucket`, comparing the percent-decoded forms.
 * @param resourceUrl - `{prefix}/{bucket}/...`
 * @param bucket - the bucket to compare against
 */
export const isResourceInBucket = (
  resourceUrl: string,
  bucket: string,
): boolean =>
  safeDecodeURIComponent(
    normalizeResourceUrl(resourceUrl).split('/')[1] ?? '',
  ) === safeDecodeURIComponent(bucket);

/**
 * Turns one stored reference into a dependency, or `undefined` when it is not
 * one: an id without a bucket (a built-in model), a resource kind that is not
 * listed, or a resource in the public bucket, which every user already reads.
 * @param resourceUrl - a DIAL Core resource url, e.g. `prompts/{bucket}/{folder}/{name}`
 */
export const toResourceDependency = (
  resourceUrl: string,
): ResourceDependencyDto | undefined => {
  const normalizedUrl = normalizeResourceUrl(resourceUrl);
  const segments = normalizedUrl.split('/');
  const type = DEPENDENCY_TYPE_BY_PREFIX[segments[0]];
  const bucket = segments[1];
  if (type == null || !bucket || bucket === PUBLIC_BUCKET) return undefined;

  const path = segments.slice(2).filter((segment) => segment.length > 0);
  const lastSegment = path.at(-1);
  if (lastSegment == null) return undefined;

  const location = path.slice(0, -1).map(safeDecodeURIComponent).join('/');
  const separatorIndex = lastSegment.lastIndexOf(VERSION_SEPARATOR);
  if (!VERSIONED_TYPES.has(type) || separatorIndex === -1) {
    return {
      id: normalizedUrl,
      name: safeDecodeURIComponent(lastSegment),
      type,
      location,
    };
  }
  return {
    id: normalizedUrl,
    name: safeDecodeURIComponent(lastSegment.slice(0, separatorIndex)),
    version: lastSegment.slice(separatorIndex + VERSION_SEPARATOR.length),
    type,
    location,
  };
};

/**
 * Collapses dependencies that share an `id`, keeping the first occurrence and the first-seen order.
 * @param dependencies - dependencies in the order they were found
 */
export const dedupeDependencies = (
  dependencies: ResourceDependencyDto[],
): ResourceDependencyDto[] => {
  const seen = new Set<string>();
  return dependencies.filter((dependency) => {
    if (seen.has(dependency.id)) return false;
    seen.add(dependency.id);
    return true;
  });
};

/**
 * The dependencies among stored references, deduplicated, in first-seen order.
 * @param resourceUrls - stored references; any that is not a dependency is ignored
 */
export const collectDependencies = (
  resourceUrls: Iterable<string>,
): ResourceDependencyDto[] => {
  const dependencies: ResourceDependencyDto[] = [];
  for (const resourceUrl of resourceUrls) {
    const dependency = toResourceDependency(resourceUrl);
    if (dependency != null) dependencies.push(dependency);
  }
  return dedupeDependencies(dependencies);
};

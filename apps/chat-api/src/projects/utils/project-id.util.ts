import { BUCKET_NAME_PATTERN } from '../../common/validators/bucket-name.pattern';
import { isValidDialEntityName } from '../../common/validators/dial-entity-name.validator';

/** Resource prefix of every DIAL project id. */
export const PROJECTS_ID_PREFIX = 'projects';

/** The parts of a `projects/{bucket}/{path…}` id. */
export interface ParsedProjectId {
  id: string;
  bucket: string;
  /** Path inside the bucket, without a leading or trailing `/`. */
  path: string;
  /** Grouping folders above the project; `undefined` at the bucket root. */
  parentPath?: string;
  /** Last path segment — a project's name is its path. */
  name: string;
}

/**
 * Parses a decoded project id. Returns `null` unless it is exactly
 * `projects/{bucket}/{segment}[/{segment}…]` with a valid bucket name and
 * every path segment a valid DIAL entity name — so no empty, `.` or `..`
 * segment, no control character and no trailing `/` ever reaches Core.
 */
export const parseProjectId = (id: unknown): ParsedProjectId | null => {
  if (typeof id !== 'string') return null;

  const [prefix, bucket, ...segments] = id.split('/');
  if (
    prefix !== PROJECTS_ID_PREFIX ||
    bucket == null ||
    !BUCKET_NAME_PATTERN.test(bucket) ||
    bucket === '.' ||
    bucket === '..' ||
    segments.length === 0 ||
    !segments.every(isValidDialEntityName)
  ) {
    return null;
  }

  return {
    id,
    bucket,
    path: segments.join('/'),
    parentPath:
      segments.length > 1 ? segments.slice(0, -1).join('/') : undefined,
    name: segments[segments.length - 1],
  };
};

/** Builds the id of a sibling project named `name` in the same folder. */
export const buildSiblingProjectId = (
  parsed: ParsedProjectId,
  name: string,
): ParsedProjectId => {
  const path = parsed.parentPath ? `${parsed.parentPath}/${name}` : name;
  return {
    id: `${PROJECTS_ID_PREFIX}/${parsed.bucket}/${path}`,
    bucket: parsed.bucket,
    path,
    parentPath: parsed.parentPath,
    name,
  };
};

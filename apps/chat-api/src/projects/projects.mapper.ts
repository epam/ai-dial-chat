import type { components } from '@epam/ai-dial-typescript-sdk';
import { StringUtils } from '../common/utils/string-utils';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { ProjectSource } from './dto/project-source.enum';
import { ProjectWatchAction } from './dto/project-watch-action.enum';
import type { ProjectWatchEventDto } from './dto/project-watch-event.dto';
import type { ProjectDto } from './dto/project.dto';

export type DialProjectMetadata = components['schemas']['MetadataBase'] & {
  nextToken?: string;
};

type DialResourceEvent = components['schemas']['ResourceEvent'];

const PROJECTS_URL_PREFIX = 'projects';

const WATCH_ACTIONS: ReadonlySet<string> = new Set(
  Object.values(ProjectWatchAction),
);

const buildProject = (
  bucket: string,
  pathSegments: string[],
  source: ProjectSource,
  item: DialProjectMetadata,
): ProjectDto => {
  const path = pathSegments.join('/');
  const parentPath =
    pathSegments.length > 1 ? pathSegments.slice(0, -1).join('/') : undefined;

  return {
    id: `${PROJECTS_URL_PREFIX}/${bucket}/${path}`,
    name: pathSegments[pathSegments.length - 1],
    bucket,
    path,
    parentPath,
    source,
    author: 'author' in item ? item.author : undefined,
    createdAt: 'createdAt' in item ? item.createdAt : undefined,
    updatedAt: 'updatedAt' in item ? item.updatedAt : undefined,
  };
};

const splitPath = (value: string | undefined): string[] =>
  (value ?? '').split('/').filter((segment) => segment.length > 0);

/**
 * Maps one `listProjectMetadata` entry to a `ProjectDto`. Grouping folders
 * and entries without `bucket`/`name` are dropped (`null`) so one malformed
 * entry never fails the listing. The id is rebuilt from identity fields
 * rather than Core's `url`, which may carry a folder-shaped trailing `/`.
 */
export const mapProjectMetadata = (
  item: DialProjectMetadata,
  source: ProjectSource,
): ProjectDto | null => {
  if (item.nodeType !== 'ITEM' || !item.bucket || !item.name) return null;

  return buildProject(
    item.bucket,
    [...splitPath(item.parentPath), ...splitPath(item.name)],
    source,
    item,
  );
};

/**
 * Maps one `getSharedResources` entry to a shared `ProjectDto`. Only items
 * whose decoded url has the `projects/{bucket}/{path…}` shape are kept —
 * anything else is dropped rather than guessed at.
 */
export const mapSharedProject = (
  item: DialProjectMetadata,
): ProjectDto | null => {
  if (item.nodeType !== 'ITEM' || item.url == null) return null;

  const url = StringUtils.stripTrailingSlashes(
    safeDecodeURIComponent(item.url),
  );
  const [prefix, bucket, ...pathSegments] = url.split('/');
  if (prefix !== PROJECTS_URL_PREFIX || !bucket) return null;

  const segments = pathSegments.filter((segment) => segment.length > 0);
  if (segments.length === 0) return null;

  return buildProject(bucket, segments, ProjectSource.Shared, item);
};

/**
 * Maps one DIAL Core resource event to a watch event for the project it
 * names. The decoded url must equal a watched id exactly, so the events of
 * files inside a project (`{id}/files/...`) and anything unexpected are
 * dropped (`null`) rather than parsed.
 */
export const mapResourceEventToProjectEvent = (
  event: DialResourceEvent,
  watchedIds: ReadonlySet<string>,
): ProjectWatchEventDto | null => {
  if (
    event.url == null ||
    event.action == null ||
    !WATCH_ACTIONS.has(event.action) ||
    typeof event.timestamp !== 'number'
  ) {
    return null;
  }

  const id = StringUtils.stripTrailingSlashes(
    safeDecodeURIComponent(event.url),
  );
  if (!watchedIds.has(id)) return null;

  return {
    id,
    action: event.action as ProjectWatchAction,
    timestamp: event.timestamp,
    ...(event.etag != null && { etag: event.etag }),
  };
};

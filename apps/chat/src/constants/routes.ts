import { safeDecodeURIComponent } from '@epam/ai-dial-chat-hooks';
import { ROUTES } from '../types/routes';
import type { SettingsTabs } from '../types/settings-tabs';

const CONVERSATION_ROUTE_PREFIX = `${ROUTES.Conversations}/`;
const CONVERSATION_ROUTE_PREFIX_NO_LEADING_SLASH =
  CONVERSATION_ROUTE_PREFIX.slice(1);

export const normalizeConversationId = (id: string): string => {
  if (id.startsWith(CONVERSATION_ROUTE_PREFIX)) {
    return id.slice(CONVERSATION_ROUTE_PREFIX.length);
  }

  if (id.startsWith(CONVERSATION_ROUTE_PREFIX_NO_LEADING_SLASH)) {
    return id.slice(CONVERSATION_ROUTE_PREFIX_NO_LEADING_SLASH.length);
  }

  return id;
};

/** Rejects an empty, `.`, or `..` path segment — guards against traversal in a route-derived id. */
export const isSafePathSegment = (segment: string): boolean =>
  segment !== '' && segment !== '.' && segment !== '..';

/*
 * Some callers (e.g. the accept-invitation flow) build this route from a
 * conversation id returned by the backend rather than one already known to
 * be well-formed. Rejecting empty/'.'/'..' segments keeps the result inside
 * the /conversations/ subtree instead of letting a malformed id navigate
 * somewhere unintended.
 */
export const getConversationRoute = (id: string): string => {
  const normalized = normalizeConversationId(id);
  const segments = normalized.split('/');
  if (segments.some((segment) => !isSafePathSegment(segment))) {
    return ROUTES.Root;
  }

  /*
   * A segment can already be percent-encoded (e.g. a Quick App deployment id
   * segment, which the backend concatenates into the conversation id as
   * received). Decoding first (safely — a raw segment can contain a literal,
   * non-percent-encoding "%") before re-encoding avoids double-encoding it.
   */
  const encoded = segments
    .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
    .join('/');
  return `${ROUTES.Conversations}/${encoded}`;
};

export const getScheduledTaskDetailRoute = (scheduleId: string): string =>
  `${ROUTES.ScheduledTasks}/${encodeURIComponent(scheduleId)}`;

export const getScheduledTaskEditRoute = (scheduleId: string): string =>
  `${getScheduledTaskDetailRoute(scheduleId)}/edit`;

const PROJECT_ID_PREFIX = 'projects/';
const PROJECT_VIEW_ROUTE_BASE = `${ROUTES.Projects}/view`;
const PROJECT_EDIT_ROUTE_BASE = `${ROUTES.Projects}/edit`;

/*
 * A project id is `projects/{bucket}/{path…}`. Its segments come from the
 * backend (or a shared link), so an id that is not that shape, or that has
 * an empty/`.`/`..` segment, falls back to the Projects list rather than
 * navigating somewhere unintended. Segments are decoded before re-encoding,
 * as in `getConversationRoute`.
 */
const buildProjectRoute = (base: string, id: string): string => {
  if (!id.startsWith(PROJECT_ID_PREFIX)) return ROUTES.Projects;
  /* DIAL Core may return a project url with a folder-shaped trailing `/`. */
  const segments = id
    .slice(PROJECT_ID_PREFIX.length)
    .replace(/\/$/, '')
    .split('/');
  if (segments.length < 2 || segments.some((s) => !isSafePathSegment(s))) {
    return ROUTES.Projects;
  }
  const encoded = segments
    .map((segment) => encodeURIComponent(safeDecodeURIComponent(segment)))
    .join('/');
  return `${base}/${encoded}`;
};

/** URL of a project's view page, or `/projects` for a malformed id. */
export const getProjectViewRoute = (id: string): string =>
  buildProjectRoute(PROJECT_VIEW_ROUTE_BASE, id);

/** URL of a project's edit page, or `/projects` for a malformed id. */
export const getProjectEditRoute = (id: string): string =>
  buildProjectRoute(PROJECT_EDIT_ROUTE_BASE, id);

/**
 * Rebuilds a project id from the `ProjectView` / `ProjectEdit` route params
 * (`:bucket` and the splat, which React Router has already decoded), or
 * `null` when a part is missing or a segment is unsafe.
 */
export const parseProjectRouteParams = (params: {
  bucket?: string;
  '*'?: string;
}): string | null => {
  const { bucket } = params;
  const path = params['*'];
  if (!bucket || !path || !isSafePathSegment(bucket)) return null;
  const segments = path.split('/');
  if (segments.some((segment) => !isSafePathSegment(segment))) return null;
  return `${PROJECT_ID_PREFIX}${bucket}/${path}`;
};

/** Canonical path of one Settings tab, e.g. `/settings/usage`. */
export const getSettingsTabRoute = (tab: SettingsTabs): string =>
  `${ROUTES.Settings}/${tab}`;

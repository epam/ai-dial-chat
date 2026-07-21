import { ROUTES } from '../types/routes';
import { safeDecodeURIComponent } from '../utils/string-utils';

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

const isSafePathSegment = (segment: string): boolean =>
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

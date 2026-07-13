import { ROUTES } from '../types/routes';

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

  const encoded = segments.map(encodeURIComponent).join('/');
  return `${ROUTES.Conversations}/${encoded}`;
};

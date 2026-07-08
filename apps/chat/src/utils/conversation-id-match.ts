import { normalizeConversationId } from '../constants/routes';
import { safeDecodeURIComponent } from './string-utils';

/** Canonical id used in the conversation panel and route matching. */
export const toPanelConversationId = (id: string): string =>
  normalizeConversationId(safeDecodeURIComponent(id));

/** Compares conversation ids from the URL, list API, and DIAL Core resource URLs. */
export const conversationIdsMatch = (left: string, right: string): boolean =>
  toPanelConversationId(left) === toPanelConversationId(right);

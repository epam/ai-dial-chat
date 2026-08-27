import { safeDecodeURIComponent } from '@epam/ai-dial-chat-hooks';
import { normalizeConversationId } from '../constants/routes';

/** Canonical id used in the conversation panel and route matching. */
export const toPanelConversationId = (id: string): string =>
  normalizeConversationId(safeDecodeURIComponent(id));

/** Compares conversation ids from the URL, list API, and DIAL Core resource URLs. */
export const conversationIdsMatch = (left: string, right: string): boolean =>
  toPanelConversationId(left) === toPanelConversationId(right);

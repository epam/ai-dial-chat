import type { StarterOption } from '@epam/ai-dial-chat-shared';

/**
 * Returns the text to populate in the input when a starter button is selected.
 * Falls back to the button title if `populateText` is empty.
 */
export const getStarterPopulateText = (starter: StarterOption): string =>
  starter['dial:widgetOptions'].populateText || starter.title;

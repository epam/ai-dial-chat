import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { getStarterPopulateText } from '../starter-option';

/**
 * Returns the text to start/populate a conversation from a selected starter button.
 * `description` (the schema property's shared intro/question text) is used only
 * as a fallback when the starter's own `populateText` is explicitly `null` — it
 * must never override a starter's own configured prompt.
 */
export const getStarterConversationText = (
  starter: StarterOption,
  description?: string,
): string => {
  const { populateText } = starter['dial:widgetOptions'];

  if (populateText == null && description) {
    return description;
  }

  return getStarterPopulateText(starter);
};

/**
 * Returns submitted text for DIAL starter/form buttons.
 * For submit buttons, `populateText: null` explicitly means "submit no text".
 * `description` (the schema property's shared intro/question text) is used only
 * as a fallback when the starter carries no text of its own — it must never
 * override a starter's own configured prompt, or every button in a group would
 * submit the same message.
 */
export const getStarterSubmitText = (
  starter: StarterOption,
  description?: string,
): string => {
  const { populateText, submit } = starter['dial:widgetOptions'];

  if (submit && populateText == null) {
    return '';
  }

  return getStarterConversationText(starter, description);
};

/**
 * Returns the text shown in the user's message bubble for a selected
 * starter/form button. Falls back to the button label for submit buttons that
 * send no text of their own.
 */
export const getStarterDisplayText = (
  starter: StarterOption,
  description?: string,
): string => getStarterSubmitText(starter, description) || starter.title;

import type { StarterOption } from '@epam/ai-dial-chat-shared';

/**
 * Returns the text to populate in the input when a starter button is selected.
 * Falls back to the button title if `populateText` is empty.
 *
 * Deliberate private duplicate of `apps/chat/src/utils/starter-option.ts`'s
 * exported `getStarterPopulateText`, kept in sync with it by hand (same
 * pattern as `isDialFileId`/`splitFileNameExtension` elsewhere in this
 * extraction) — the app copy is still used directly by other app-side
 * consumers, so it could not simply be re-exported from here.
 */
const getStarterPopulateText = (starter: StarterOption): string =>
  starter['dial:widgetOptions'].populateText || starter.title;

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
 */
export const getStarterSubmitText = (
  starter: StarterOption,
  description?: string,
): string => {
  const { populateText, submit } = starter['dial:widgetOptions'];

  if (submit && populateText == null) {
    return '';
  }

  return description ?? getStarterPopulateText(starter);
};

import type {
  DeploymentConfigurationSchema,
  StarterOption,
} from '@epam/ai-dial-chat-shared';

/**
 * Returns the text to populate in the input when a starter button is selected.
 * Falls back to the button title if `populateText` is empty.
 */
export const getStarterPopulateText = (starter: StarterOption): string =>
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

/**
 * Extracts starter options, the schema property key (`'starter'` or `'button'`),
 * and the optional description text from a deployment configuration schema.
 *
 * - `propertyKey` — `'starter'` or `'button'`; used to build `configuration_value`.
 * - `description` — human-readable prompt shown above the buttons (only present for `button` properties).
 *
 * Returns an empty starters array and `undefined` fields when no matching property is found.
 */
export const getStartersFromSchema = (
  schema: DeploymentConfigurationSchema | null | undefined,
): {
  starters: StarterOption[];
  propertyKey: string | undefined;
  description: string | undefined;
} => {
  const properties = schema?.properties;
  if (!properties) {
    return { starters: [], propertyKey: undefined, description: undefined };
  }

  let key: string | undefined;
  if ('starter' in properties) {
    key = 'starter';
  } else if ('button' in properties) {
    key = 'button';
  }

  if (!key) {
    return { starters: [], propertyKey: undefined, description: undefined };
  }

  const property = properties[key];
  const oneOf = property?.oneOf;
  const description =
    typeof property?.description === 'string'
      ? property.description
      : undefined;

  if (!Array.isArray(oneOf)) {
    return { starters: [], propertyKey: key, description };
  }

  return { starters: oneOf as StarterOption[], propertyKey: key, description };
};

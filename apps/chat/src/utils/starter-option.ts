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

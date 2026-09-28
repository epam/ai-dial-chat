/*
 * Length limits shared by every entity editor (prompts, skills, toolsets,
 * applications, scheduled tasks), so a name, description or instructions
 * field accepts the same amount of text everywhere. The chat-api DTOs
 * enforce the same numbers server-side.
 */

/** Maximum length of an entity's name or display name. */
export const ENTITY_NAME_MAX_LENGTH = 256;

/** Maximum length of an entity's description. */
export const ENTITY_DESCRIPTION_MAX_LENGTH = 2000;

/** Maximum length of an entity's instructions (prompt body, system prompt, skill instructions). */
export const ENTITY_INSTRUCTIONS_MAX_LENGTH = 50000;

const CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;

/** Whether `value` is longer than `maxLength` characters. */
export const exceedsMaxLength = (value: string, maxLength: number): boolean =>
  value.length > maxLength;

/** Whether `value` contains a control character (line break, tab, NUL, …) that a single-line name must not carry. */
export const hasControlCharacters = (value: string): boolean =>
  CONTROL_CHARACTER_PATTERN.test(value);

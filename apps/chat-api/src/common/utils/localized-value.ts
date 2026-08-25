import type { components } from '@epam/ai-dial-typescript-sdk';

type LocalizedValue = components['schemas']['LocalizedValue'];

/**
 * Extracts a plain display string from a DIAL Core `LocalizedValue` field
 * (a plain string, or a locale-code -> value map), preferring the plain
 * string form, then the first entry of the locale map, otherwise
 * `undefined`.
 */
export const resolveLocalizedValue = (
  value: LocalizedValue | undefined,
): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;

  return Object.values(value)[0];
};

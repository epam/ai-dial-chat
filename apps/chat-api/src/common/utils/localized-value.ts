import type { components } from '@epam/ai-dial-typescript-sdk';

type LocalizedValue = components['schemas']['LocalizedValue'];

/**
 * Extracts a plain display string from a DIAL Core `LocalizedValue` field
 * (`{ plainValue?, localeMap? }`), preferring `plainValue`, then the first
 * entry of `localeMap`, otherwise `undefined`.
 */
export const resolveLocalizedValue = (
  value: LocalizedValue | undefined,
): string | undefined => {
  if (value == null) return undefined;
  if (value.plainValue != null) return value.plainValue;

  const localeValues = value.localeMap ? Object.values(value.localeMap) : [];
  return localeValues[0];
};

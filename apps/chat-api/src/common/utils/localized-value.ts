import type { components } from '@epam/ai-dial-typescript-sdk';

type LocalizedValue = components['schemas']['LocalizedValue'];

/**
 * Extracts a plain display string from a DIAL Core `LocalizedValue` field
 * (a plain string, or a locale-code -> value map), preferring the plain
 * string form, then the `preferredLocale` entry of the locale map, then its
 * first entry, otherwise `undefined`.
 * @param value - the stored localized value
 * @param preferredLocale - locale code to take from a locale map before falling back to its first entry
 */
export const resolveLocalizedValue = (
  value: LocalizedValue | undefined,
  preferredLocale?: string,
): string | undefined => {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;

  const preferredValue =
    preferredLocale == null ? undefined : value[preferredLocale];
  if (typeof preferredValue === 'string') return preferredValue;

  const firstValue = Object.values(value)[0];
  return typeof firstValue === 'string' ? firstValue : undefined;
};

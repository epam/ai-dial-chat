import type { components } from '@epam/ai-dial-typescript-sdk';
import type { LocaleTextEntryDto } from '../dto/locale-text-entry.dto';
import type { LocalizedText } from '../types/localized-text';

type LocalizedValue = components['schemas']['LocalizedValue'];

const DEFAULT_PRIMARY_LOCALE = 'en';

/** Result of composing a primary name/description with additional locale entries. */
export interface ComposedLocalizedFields {
  displayName: LocalizedText;
  description?: LocalizedText;
}

/**
 * Composes `name`/`description` into DIAL Core's `displayName`/`description`
 * fields. Returns plain strings, unchanged, when `locales` is absent or
 * empty. Otherwise returns a locale map seeded with `primaryLocale ->
 * name`/`description` (defaulting `primaryLocale` to `'en'`) plus one entry
 * per `locales` row; a row's empty `name`/`description` is skipped so it
 * never overwrites the primary/other entries with an empty string.
 */
export const composeLocalizedFields = (
  name: string,
  description: string | undefined,
  locales: LocaleTextEntryDto[] | undefined,
  primaryLocale: string | undefined,
): ComposedLocalizedFields => {
  if (!locales || locales.length === 0) {
    return { displayName: name, description };
  }

  const primary = primaryLocale ?? DEFAULT_PRIMARY_LOCALE;
  const displayName: Record<string, string> = { [primary]: name };
  const descriptionMap: Record<string, string> =
    description != null ? { [primary]: description } : {};

  for (const entry of locales) {
    if (entry.name) displayName[entry.language] = entry.name;
    if (entry.description) descriptionMap[entry.language] = entry.description;
  }

  return {
    displayName,
    description:
      Object.keys(descriptionMap).length > 0 ? descriptionMap : undefined,
  };
};

/**
 * Converts a {@link LocalizedText} (plain string or locale map) into the
 * verified SDK's `LocalizedValue` shape (`{ plainValue?, localeMap? }`) —
 * the wire format `Application.displayName`/`ToolSet.displayName` require
 * since the `@epam/ai-dial-typescript-sdk` upgrade to `0.1.0-dev.35`.
 */
export const toLocalizedValue = (text: LocalizedText): LocalizedValue =>
  typeof text === 'string' ? { plainValue: text } : { localeMap: text };

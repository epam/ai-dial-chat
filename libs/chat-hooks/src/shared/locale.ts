import type { LocaleTextEntryDto } from '@epam/ai-dial-chat-api-client';
import type {
  DeploymentCreationFormLocaleEntry,
  DeploymentCreationFormLocaleOption,
} from '@epam/ai-dial-deployment-creation-form';

/** Lowercased base language of a BCP-47 tag, e.g. `'en-US'` -> `'en'`. */
export const toBaseLocale = (locale: string): string =>
  locale.split('-')[0].toLowerCase();

/**
 * DIAL Core's shape for a user-facing text field: either a plain string (no
 * localized variants — displayed identically for every locale) or a map of
 * locale code to translated value.
 */
export type LocalizedText = string | Record<string, string>;

/**
 * Resolves a `LocalizedText` value to a single display string for
 * `activeLocale`: exact locale match, then base-language match, then
 * `primaryLocale`, then the first defined value in the map, then `''`. A
 * plain string is returned unchanged — it has no locale variants.
 */
export const resolveLocalizedText = (
  value: LocalizedText | undefined | null,
  activeLocale: string,
  primaryLocale: string,
): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  const base = toBaseLocale(activeLocale);
  return (
    value[activeLocale] ??
    value[base] ??
    value[primaryLocale] ??
    Object.values(value).find((entry) => entry !== undefined) ??
    ''
  );
};

/** Appends a locale's uppercased code to a field label, e.g. `'Name [EN]'`. */
export const appendLocaleCode = (label: string, locale: string): string =>
  `${label} [${toBaseLocale(locale).toUpperCase()}]`;

/**
 * Composes the "Add locale" popup's entries into the write-payload shape:
 * strips the popup's client-only `id`, drops rows with no `language`, drops
 * rows with neither `name` nor `description`, drops rows colliding with
 * `primaryLocale` (that content belongs in the primary field, not here), and
 * dedupes by `language` (last row for a given language wins). Returns
 * `undefined` (not `[]`) when nothing remains, so a request untouched by
 * this feature stays byte-identical to today.
 */
export const composeLocalePayload = (
  otherLocales: DeploymentCreationFormLocaleEntry[],
  primaryLocale: string,
): LocaleTextEntryDto[] | undefined => {
  const byLanguage = new Map<string, LocaleTextEntryDto>();

  for (const entry of otherLocales) {
    if (!entry.language || entry.language === primaryLocale) continue;
    if (!entry.name && !entry.description) continue;
    byLanguage.set(entry.language, {
      language: entry.language,
      name: entry.name || undefined,
      description: entry.description || undefined,
    });
  }

  return byLanguage.size > 0 ? Array.from(byLanguage.values()) : undefined;
};

/**
 * Inverse of {@link composeLocalePayload}: builds the popup's `otherLocales`
 * entries from a `displayName`/`description` pair as read from DIAL Core.
 * A plain string on both (or both absent) means no additional locales exist
 * yet, so this returns `[]`. Otherwise one entry is built per locale key
 * present in either map, excluding `primaryLocale` — that key is already the
 * primary Name/Description field, not a row in the popup.
 */
export const decomposeLocalizedFields = (
  displayName: LocalizedText | undefined,
  description: LocalizedText | undefined,
  primaryLocale: string,
): DeploymentCreationFormLocaleEntry[] => {
  const nameMap = typeof displayName === 'object' ? displayName : {};
  const descriptionMap = typeof description === 'object' ? description : {};
  const languages = new Set([
    ...Object.keys(nameMap),
    ...Object.keys(descriptionMap),
  ]);
  languages.delete(primaryLocale);

  let rowId = 0;
  return Array.from(languages, (language) => ({
    id: `decomposed-locale-${++rowId}`,
    language,
    name: nameMap[language] ?? '',
    description: descriptionMap[language] ?? '',
  }));
};

/**
 * Selectable additional-locale options for a locale-picker popup, drawn from
 * `additionalLocaleCodes` and excluding whichever code is already the
 * primary Name/Description field.
 */
export const buildAdditionalLocaleOptions = (
  additionalLocaleCodes: string[],
  primaryLocale: string,
): DeploymentCreationFormLocaleOption[] =>
  additionalLocaleCodes
    .filter((code) => code !== primaryLocale)
    .map((code) => ({ code, label: code.toUpperCase() }));

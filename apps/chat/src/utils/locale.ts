import type {
  DeploymentCreationFormLocaleEntry,
  DeploymentCreationFormLocaleLabels,
  DeploymentCreationFormLocaleOption,
} from '@epam/ai-dial-deployment-creation-form';
import type { LocaleTextEntryDto } from '@epam/ai-dial-chat-api-client';
import type { TFunction } from 'i18next';
import { ButtonsI18nKeys, EditorI18nKeys } from '../constants/translation-keys';
import { SUPPORTED_LANGUAGES } from '../hooks/language/useLanguage';

/** Lowercased base language of a BCP-47 tag, e.g. `'en-US'` -> `'en'`. */
export const toBaseLocale = (locale: string): string =>
  locale.split('-')[0].toLowerCase();

/**
 * The fixed content language of the primary Name/Description fields.
 * Independent of the viewer's own UI language — always the first configured
 * supported language. Reordering `SUPPORTED_LANGUAGES` changes this value,
 * which would silently change which locale existing backend data is stored
 * under, so treat any such reorder as a breaking data-migration concern, not
 * a routine UI tweak.
 */
export const PRIMARY_LOCALE = SUPPORTED_LANGUAGES[0].code;

/**
 * DIAL Core's shape for a user-facing text field: either a plain string (no
 * localized variants — displayed identically for every locale) or a map of
 * locale code to translated value.
 */
export type LocalizedText = string | Record<string, string>;

/**
 * Resolves a `LocalizedText` value to a single display string for
 * `activeLocale`: exact locale match, then base-language match, then
 * `PRIMARY_LOCALE`, then the first defined value in the map, then `''`. A
 * plain string is returned unchanged — it has no locale variants.
 */
export const resolveLocalizedText = (
  value: LocalizedText | undefined | null,
  activeLocale: string,
): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  const base = toBaseLocale(activeLocale);
  return (
    value[activeLocale] ??
    value[base] ??
    value[PRIMARY_LOCALE] ??
    Object.values(value).find((entry) => entry !== undefined) ??
    ''
  );
};

/** Appends a locale's uppercased code to a field label, e.g. `'Name [EN]'`. */
export const appendLocaleCode = (label: string, locale: string): string =>
  `${label} [${toBaseLocale(locale).toUpperCase()}]`;

/**
 * Locale codes offered as translation targets in the "Add locale" popup.
 * Deliberately separate from `SUPPORTED_LANGUAGES` (the UI's own
 * display-language switcher, which only lists languages with a full
 * `<code>.json` translation bundle): a content locale is user-authored data
 * attached to a toolset/application, not an app UI string, so it never
 * requires a UI translation file to be offered here.
 */
const ADDITIONAL_CONTENT_LOCALE_CODES: string[] = ['de'];

/**
 * Selectable additional-locale options for the "Add locale" popup: every
 * content locale except the fixed primary one, which is already the primary
 * Name/Description field.
 */
export const buildAdditionalLocaleOptions =
  (): DeploymentCreationFormLocaleOption[] =>
    ADDITIONAL_CONTENT_LOCALE_CODES.filter(
      (code) => code !== PRIMARY_LOCALE,
    ).map((code) => ({ code, label: code.toUpperCase() }));

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

/** Translated labels for the "Add locale" summary row and popup, sourced from shared button strings where they already exist. */
export const buildLocaleFieldLabels = (
  t: TFunction,
): DeploymentCreationFormLocaleLabels => ({
  summaryLabel: t(EditorI18nKeys.LocalesSummaryLabel),
  editLabel: t(ButtonsI18nKeys.Edit),
  popupTitle: t(EditorI18nKeys.LocalesPopupTitle),
  addLocaleLabel: t(EditorI18nKeys.LocalesAddLocaleLabel),
  localeRowLabel: t(EditorI18nKeys.LocalesRowLabel),
  languageLabel: t(EditorI18nKeys.LocalesLanguageLabel),
  nameLabel: t(EditorI18nKeys.LocalesNameLabel),
  namePlaceholder: t(EditorI18nKeys.LocalesNamePlaceholder),
  descriptionLabel: t(EditorI18nKeys.LocalesDescriptionLabel),
  descriptionPlaceholder: t(EditorI18nKeys.LocalesDescriptionPlaceholder),
  deleteAriaLabel: t(EditorI18nKeys.LocalesDeleteAriaLabel),
  cancelLabel: t(ButtonsI18nKeys.Cancel),
  saveLabel: t(ButtonsI18nKeys.Save),
});

import type {
  DeploymentCreationFormLocaleLabels,
  DeploymentCreationFormLocaleOption,
} from '@epam/ai-dial-builder-form';
import {
  buildAdditionalLocaleOptions as buildAdditionalLocaleOptionsLib,
  resolveLocalizedText as resolveLocalizedTextLib,
  type LocalizedText,
} from '@epam/ai-dial-chat-hooks';
import type { TFunction } from 'i18next';
import { ButtonsI18nKeys, EditorI18nKeys } from '../constants/translation-keys';
import { SUPPORTED_LANGUAGES } from '../hooks/language/useLanguage';

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
 * Resolves a `LocalizedText` value to a single display string for
 * `activeLocale`, falling back to {@link PRIMARY_LOCALE} when neither an
 * exact nor a base-language match exists. See
 * `@epam/ai-dial-chat-hooks`'s `resolveLocalizedText` for the full fallback
 * order.
 */
export const resolveLocalizedText = (
  value: LocalizedText | undefined | null,
  activeLocale: string,
): string => resolveLocalizedTextLib(value, activeLocale, PRIMARY_LOCALE);

/**
 * Names a content locale code in its own language (`de` → `Deutsch`), falling
 * back to the uppercased code when `Intl.DisplayNames` cannot resolve it. An
 * autonym does not change with the viewer's UI language.
 */
export const getLocaleDisplayName = (code: string): string => {
  const fallback = code.toUpperCase();
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code);
    if (!name || name.toLowerCase() === code.toLowerCase()) return fallback;
    return name;
  } catch {
    return fallback;
  }
};

/**
 * Selectable additional-locale options for the "Add locale" popup: every
 * configured content locale (`AppConfigContext`'s `additionalContentLocales`)
 * except the fixed primary one, which is already the primary Name/Description
 * field. Content locales are deliberately separate from `SUPPORTED_LANGUAGES`:
 * they are user-authored data and never need a UI translation bundle.
 */
export const buildAdditionalLocaleOptions = (
  codes: string[],
): DeploymentCreationFormLocaleOption[] =>
  buildAdditionalLocaleOptionsLib(codes, PRIMARY_LOCALE, getLocaleDisplayName);

/** Translated labels for the "Add locale" summary row and popup, sourced from shared button strings where they already exist. */
export const buildLocaleFieldLabels = (
  t: TFunction,
): DeploymentCreationFormLocaleLabels => ({
  summaryLabel: t(EditorI18nKeys.LocalesSummaryLabel),
  addLabel: t(EditorI18nKeys.LocalesAddLabel),
  editLabel: t(EditorI18nKeys.LocalesEditLabel),
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

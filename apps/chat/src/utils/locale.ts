import {
  appendLocaleCode,
  buildAdditionalLocaleOptions as buildAdditionalLocaleOptionsLib,
  composeLocalePayload,
  decomposeLocalizedFields,
  resolveLocalizedText as resolveLocalizedTextLib,
  toBaseLocale,
  type LocalizedText,
} from '@epam/ai-dial-chat-hooks';
import type {
  DeploymentCreationFormLocaleLabels,
  DeploymentCreationFormLocaleOption,
} from '@epam/ai-dial-deployment-creation-form';
import type { TFunction } from 'i18next';
import { ButtonsI18nKeys, EditorI18nKeys } from '../constants/translation-keys';
import { SUPPORTED_LANGUAGES } from '../hooks/language/useLanguage';

export {
  appendLocaleCode,
  composeLocalePayload,
  decomposeLocalizedFields,
  toBaseLocale,
};
export type { LocalizedText };

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
    buildAdditionalLocaleOptionsLib(
      ADDITIONAL_CONTENT_LOCALE_CODES,
      PRIMARY_LOCALE,
    );

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

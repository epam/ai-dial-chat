import { TranslationOptions } from '@/src/types/translation';

import { DEFAULT_PROMPT_NAME } from '@/src/constants/default-ui-settings';
import { PromptBarI18nKeys } from '@/src/constants/i18n';

import escapeRegExp from 'lodash-es/escapeRegExp';

type TranslateFn = (key: string, options?: TranslationOptions) => string;

function translateDefaultPromptLabel(
  locale: string | undefined,
  t: TranslateFn,
): string {
  if (!locale || locale === 'en') {
    return DEFAULT_PROMPT_NAME;
  }

  return t(PromptBarI18nKeys.PromptEntity);
}

function getNumberedDefaultPromptRegex() {
  return new RegExp(`^${escapeRegExp(DEFAULT_PROMPT_NAME)} (\\d+)$`);
}

export function translatePromptDisplayName(
  name: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  if (name === DEFAULT_PROMPT_NAME) {
    return translateDefaultPromptLabel(locale, t);
  }

  const match = name.match(getNumberedDefaultPromptRegex());
  if (match) {
    return `${translateDefaultPromptLabel(locale, t)} ${match[1]}`;
  }

  return name;
}

export function promptDisplayNameToStorage(
  displayName: string,
  storedName: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  const translatedLabel = translateDefaultPromptLabel(locale, t);
  const translatedPrefix = `${translatedLabel} `;

  if (storedName === DEFAULT_PROMPT_NAME) {
    if (displayName === translatedLabel) {
      return DEFAULT_PROMPT_NAME;
    }

    if (displayName === DEFAULT_PROMPT_NAME) {
      return displayName;
    }

    return displayName;
  }

  const storedMatch = storedName.match(getNumberedDefaultPromptRegex());
  if (storedMatch) {
    if (displayName.startsWith(translatedPrefix)) {
      return `${DEFAULT_PROMPT_NAME} ${displayName.slice(translatedPrefix.length)}`;
    }

    if (displayName.startsWith(`${DEFAULT_PROMPT_NAME} `)) {
      return displayName;
    }

    return displayName;
  }

  return displayName;
}

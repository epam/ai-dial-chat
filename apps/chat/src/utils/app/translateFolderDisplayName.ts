import { TranslationOptions } from '@/src/types/translation';

import { DEFAULT_FOLDER_NAME } from '@/src/constants/default-ui-settings';
import { SideBarI18nKeys } from '@/src/constants/i18n';

import escapeRegExp from 'lodash-es/escapeRegExp';

type TranslateFn = (key: string, options?: TranslationOptions) => string;

function translateNewFolderLabel(
  _locale: string | undefined,
  t: TranslateFn,
): string {
  return t(SideBarI18nKeys.NewFolder);
}

function getNumberedDefaultFolderRegex() {
  return new RegExp(`^${escapeRegExp(DEFAULT_FOLDER_NAME)} (\\d+)$`);
}

export function translateFolderDisplayName(
  name: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  if (name === DEFAULT_FOLDER_NAME) {
    return translateNewFolderLabel(locale, t);
  }

  const match = name.match(getNumberedDefaultFolderRegex());
  if (match) {
    return `${translateNewFolderLabel(locale, t)} ${match[1]}`;
  }

  return name;
}

export function folderDisplayNameToStorage(
  displayName: string,
  storedName: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  const translatedLabel = translateNewFolderLabel(locale, t);
  const translatedPrefix = `${translatedLabel} `;

  if (storedName === DEFAULT_FOLDER_NAME) {
    if (displayName === translatedLabel) {
      return DEFAULT_FOLDER_NAME;
    }

    if (displayName === DEFAULT_FOLDER_NAME) {
      return displayName;
    }

    return displayName;
  }

  const storedMatch = storedName.match(getNumberedDefaultFolderRegex());
  if (storedMatch) {
    if (displayName.startsWith(translatedPrefix)) {
      return `${DEFAULT_FOLDER_NAME} ${displayName.slice(translatedPrefix.length)}`;
    }

    if (displayName.startsWith(`${DEFAULT_FOLDER_NAME} `)) {
      return displayName;
    }

    return displayName;
  }

  return displayName;
}

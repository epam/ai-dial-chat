import { TranslationOptions } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

type TranslateFn = (key: string, options?: TranslationOptions) => string;

const LEGACY_NEW_REQUEST_BY_UNKNOWN = 'New request by Unknown Author';
const LEGACY_NEW_REQUEST_BY_PREFIX = /^New request by (.+)$/;

function translatePublicationLabel(
  key: string,
  _locale: string | undefined,
  t: TranslateFn,
  options?: TranslationOptions,
): string {
  return t(key, options);
}

export function getPublicationDefaultName(
  userName: string | undefined,
  locale: string | undefined,
  t: TranslateFn,
): string {
  const trimmed = userName?.trim();
  if (trimmed) {
    return translatePublicationLabel(ChatI18nKeys.NewRequestBy, locale, t, {
      userName: trimmed,
    });
  }

  return translatePublicationLabel(ChatI18nKeys.NewRequest, locale, t);
}

export function translatePublicationDisplayName(
  name: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  if (name === LEGACY_NEW_REQUEST_BY_UNKNOWN) {
    return translatePublicationLabel(ChatI18nKeys.NewRequest, locale, t);
  }

  const match = name.match(LEGACY_NEW_REQUEST_BY_PREFIX);
  if (match) {
    const author = match[1].trim();
    if (author === 'Unknown Author') {
      return translatePublicationLabel(ChatI18nKeys.NewRequest, locale, t);
    }

    return translatePublicationLabel(ChatI18nKeys.NewRequestBy, locale, t, {
      userName: author,
    });
  }

  return name;
}

export function translatePublicationChatLabel(
  key: string,
  locale: string | undefined,
  t: TranslateFn,
): string {
  return translatePublicationLabel(key, locale, t);
}

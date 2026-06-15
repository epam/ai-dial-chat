import { Translation } from '@/src/types/translation';

import { ChatI18nKeys, SideBarI18nKeys } from '@/src/constants/i18n';

type TranslateFn = (
  key: string,
  options?: { lng?: string; ns?: Translation },
) => string;

export function translateFileManagerChrome(
  key: string,
  locale: string | undefined,
  t: TranslateFn,
  translateChat: TranslateFn,
): string {
  const lngOptions = locale ? { lng: locale } : undefined;
  const translateWithLocale = (fn: TranslateFn): string =>
    lngOptions ? fn(key, lngOptions) : fn(key);

  const translators =
    locale && locale !== 'en'
      ? [translateChat, t]
      : [t, translateChat];

  for (const translate of translators) {
    const result = translateWithLocale(translate);
    if (result !== key) {
      return result;
    }
  }

  const sidebar = translateWithLocale(t);
  const chat = translateWithLocale(translateChat);

  if (key === SideBarI18nKeys.FileManagerSearchPlaceholder) {
    const search = lngOptions
      ? translateChat(ChatI18nKeys.Search, lngOptions)
      : translateChat(ChatI18nKeys.Search);
    if (search !== ChatI18nKeys.Search) {
      return `${search}...`;
    }
  }

  return chat !== key ? chat : sidebar;
}

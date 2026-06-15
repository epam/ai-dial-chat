import { i18n as defaultI18n } from 'next-i18next';

import { Translation, TranslationOptions } from '@/src/types/translation';

const supplementalLocaleLoads = new Map<string, Promise<void>>();

export const translate = (text: string, options?: TranslationOptions) =>
  defaultI18n
    ? options
      ? defaultI18n.t(text, options)
      : (defaultI18n.t(text) as unknown as string)
    : text;

export const isLocaleNamespaceKeyMissing = (
  locale: string,
  namespace: Translation,
  key: string,
  i18nInstance = defaultI18n,
): boolean => {
  if (!i18nInstance) {
    return true;
  }

  const bundle = i18nInstance.getResourceBundle(locale, namespace) as
    | Record<string, string>
    | undefined;

  return !bundle?.[key];
};

export const ensureLocaleNamespaceFromStaticFiles = (
  locale: string,
  namespace: Translation,
  i18nInstance = defaultI18n,
): Promise<void> => {
  const cacheKey = `${locale}:${namespace}`;
  const existingLoad = supplementalLocaleLoads.get(cacheKey);
  if (existingLoad) {
    return existingLoad;
  }

  const load = fetch(`/locales/${locale}/${namespace}.json`)
    .then(async (response) => {
      if (!response.ok || !i18nInstance) {
        return;
      }

      const bundle = (await response.json()) as Record<string, string>;
      i18nInstance.addResourceBundle(locale, namespace, bundle, true, true);
    })
    .catch(() => undefined);

  supplementalLocaleLoads.set(cacheKey, load);
  return load;
};

import { useCallback } from 'react';

import { useTranslation as useNextTranslation } from 'next-i18next';

import { Translation, TranslationOptions } from '../types/translation';

export const useTranslation = (translationNamespace: Translation) => {
  const { t } = useNextTranslation(translationNamespace);

  const translate = useCallback(
    (key: string, options?: TranslationOptions) =>
      ((options ? t(key, options) : t(key)) as unknown as string) ?? key ?? '',
    [t],
  );
  return {
    t: translate,
  };
};

import { useCallback } from 'react';

import { useTranslation as useNextTranslation } from 'next-i18next';

import { Translation } from '../types/translation';

export const useTranslation = (translationNamespace: Translation) => {
  const { t } = useNextTranslation(translationNamespace);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const translate = useCallback(
    (key: string, options?: any) =>
      (t(key, options) as unknown as string) ?? key,
    [t],
  );
  return {
    t: translate,
  };
};

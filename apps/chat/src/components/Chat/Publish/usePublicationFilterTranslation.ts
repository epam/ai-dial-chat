import { useEffect, useState } from 'react';

import { useTranslation as useNextTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  ensureLocaleNamespaceFromStaticFiles,
  isLocaleNamespaceKeyMissing,
} from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import {
  PUBLICATION_FILTER_I18N_KEYS,
  translatePublicationFilterSourceLabel,
  translatePublicationFunctionLabel,
} from '@/src/components/Chat/Publish/translatePublicationFilterLabel';

export function usePublicationFilterTranslation() {
  const router = useRouter();
  const { i18n } = useNextTranslation(Translation.SideBar);
  const { t } = useTranslation(Translation.SideBar);
  const [supplementalLabelsVersion, setSupplementalLabelsVersion] = useState(0);

  useEffect(() => {
    const locale = router.locale ?? 'en';
    if (locale === 'en') {
      return;
    }

    const hasMissingKeys = PUBLICATION_FILTER_I18N_KEYS.some((key) =>
      isLocaleNamespaceKeyMissing(locale, Translation.SideBar, key, i18n),
    );

    if (!hasMissingKeys) {
      return;
    }

    void ensureLocaleNamespaceFromStaticFiles(
      locale,
      Translation.SideBar,
      i18n,
    ).then(() => {
      setSupplementalLabelsVersion((version) => version + 1);
    });
  }, [i18n, router.locale]);

  return {
    supplementalLabelsVersion,
    translateSource: (source: string) =>
      translatePublicationFilterSourceLabel(source, t),
    translateFunction: (filterType: string) =>
      translatePublicationFunctionLabel(filterType, t),
  };
}

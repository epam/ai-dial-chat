import { useEffect, useState } from 'react';

import { useTranslation as useNextTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  ensureLocaleNamespaceFromStaticFiles,
  shouldSupplementLocaleNamespace,
} from '@/src/utils/app/translation';
import {
  TOPIC_I18N_KEY_VALUES,
  translateTopicLabel,
} from '@/src/utils/app/translateTopicLabel';

import { Translation } from '@/src/types/translation';

export function useTopicTranslation() {
  const router = useRouter();
  const { i18n } = useNextTranslation(Translation.Common);
  const { t } = useTranslation(Translation.Common);
  const [supplementalLabelsVersion, setSupplementalLabelsVersion] = useState(0);

  useEffect(() => {
    const locale = router.locale ?? 'en';
    if (locale === 'en') {
      return;
    }

    const shouldSupplement = shouldSupplementLocaleNamespace(
      locale,
      Translation.Common,
      TOPIC_I18N_KEY_VALUES,
      i18n,
    );

    if (!shouldSupplement) {
      return;
    }

    void ensureLocaleNamespaceFromStaticFiles(
      locale,
      Translation.Common,
      i18n,
    ).then(() => {
      setSupplementalLabelsVersion((version) => version + 1);
    });
  }, [i18n, router.locale]);

  return {
    supplementalLabelsVersion,
    translateTopic: (topic: string) => translateTopicLabel(topic, t),
  };
}

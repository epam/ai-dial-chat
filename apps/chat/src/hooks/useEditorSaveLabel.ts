import { useEffect, useState } from 'react';

import { useTranslation as useNextTranslation } from 'next-i18next';
import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  ensureLocaleNamespaceFromStaticFiles,
  shouldSupplementLocaleNamespace,
} from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

const EDITOR_SAVE_LABEL_KEYS = [ChatI18nKeys.Exit, ChatI18nKeys.SaveAndExit];

export function useEditorSaveLabel(isSaveAndExit: boolean) {
  const router = useRouter();
  const { i18n } = useNextTranslation(Translation.Chat);
  const { t: tChat } = useTranslation(Translation.Chat);
  const [supplementalLabelsVersion, setSupplementalLabelsVersion] = useState(0);

  useEffect(() => {
    const locale = router.locale ?? 'en';
    if (locale === 'en') {
      return;
    }

    const shouldSupplement = shouldSupplementLocaleNamespace(
      locale,
      Translation.Chat,
      EDITOR_SAVE_LABEL_KEYS,
      i18n,
    );

    if (!shouldSupplement) {
      return;
    }

    void ensureLocaleNamespaceFromStaticFiles(
      locale,
      Translation.Chat,
      i18n,
    ).then(() => {
      setSupplementalLabelsVersion((version) => version + 1);
    });
  }, [i18n, router.locale]);

  void supplementalLabelsVersion;

  return isSaveAndExit
    ? tChat(ChatI18nKeys.SaveAndExit)
    : tChat(ChatI18nKeys.Exit);
}

import Head from 'next/head';
import { useRouter } from 'next/router';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getPageName } from '@/src/utils/app/route';

import { Translation } from '@/src/types/translation';

import { SettingsState } from '@/src/store/settings/settings.types';

import { CommonI18nKeys } from '@/src/constants/i18n';

export function Title({ settings }: { settings?: SettingsState }) {
  const router = useRouter();
  const { t } = useTranslation(Translation.Common);
  const pageName = t(getPageName(router));

  return (
    <Head>
      <title className="whitespace-pre">
        {[settings?.appName, pageName].filter(Boolean).join(' : ')}
      </title>
      <meta name="description" content={t(CommonI18nKeys.ChatGPTButBetter)} />
    </Head>
  );
}

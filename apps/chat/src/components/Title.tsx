import Head from 'next/head';
import { useRouter } from 'next/router';

import { useTranslation } from '../hooks/useTranslation';

import { getPageName } from '../utils/app/route';

import { Translation } from '../types/translation';

import { SettingsState } from '../store/settings/settings.types';

export function Title({ settings }: { settings?: SettingsState }) {
  const router = useRouter();
  const { t } = useTranslation(Translation.Common);
  const pageName = t(getPageName(router));

  return (
    <Head>
      <title className="whitespace-pre">
        {[settings?.appName, pageName].filter(Boolean).join(' : ')}
      </title>
      <meta name="description" content={t('ChatGPT but better.')} />
      <meta
        name="viewport"
        content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
      />
    </Head>
  );
}

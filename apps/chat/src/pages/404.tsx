import { IconPlus } from '@tabler/icons-react';

import { useTranslation } from '../hooks/useTranslation';

import { Translation } from '../types/translation';

import { getLayout } from './_app';

function Custom404() {
  const { t } = useTranslation(Translation.Common);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center space-y-4 px-4 text-center">
      <h1 className="text-6xl font-bold md:text-7xl">{t('404')}</h1>

      <div className="space-y-2">
        <p className="text-xl font-bold md:text-2xl">{t('Page not found')}</p>
        <p className="text-base text-secondary">
          {t("It seems like the page you're looking for doesn't exist.")}
        </p>
      </div>

      <a
        className="button button-secondary flex items-center gap-2 rounded"
        href={`/`}
      >
        <IconPlus size={18} />
        {t('New Conversation')}
      </a>
    </div>
  );
}

Custom404.getLayout = getLayout;
export default Custom404;

import { IconPlus } from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { Title } from '@/src/components/Title';

function Custom404() {
  const { t } = useTranslation(Translation.Common);

  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center space-y-4 px-4 text-center"
      data-qa="not-found-container"
    >
      <Title />
      <h1 className="text-6xl font-bold md:text-7xl" data-qa="not-found-header">
        {t(CommonI18nKeys.NotFound)}
      </h1>

      <div className="space-y-2">
        <p className="text-xl font-bold md:text-2xl" data-qa="not-found-title">
          {t(CommonI18nKeys.PageNotFound)}
        </p>
        <p className="text-base text-secondary" data-qa="not-found-description">
          {t(CommonI18nKeys.PageNotFoundDescription)}
        </p>
      </div>

      <a
        className="button button-secondary flex items-center gap-2 rounded"
        href={`/`}
        data-qa="new-conversation-btn"
      >
        <IconPlus size={18} />
        {t(CommonI18nKeys.NewConversation)}
      </a>
    </div>
  );
}

export default Custom404;

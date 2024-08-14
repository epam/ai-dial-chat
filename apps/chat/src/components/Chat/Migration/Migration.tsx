import React from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { Spinner } from '@/src/components/Common/Spinner';

interface Props {
  total: number;
  uploaded: number;
}

export const Migration = ({ total, uploaded }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <Spinner className="h-auto" size={60} />
      <h1 className="mt-7 text-2xl font-semibold md:text-3xl">
        {t('chat.migration.header.text')}
      </h1>
      <p className="mt-7 text-center text-base md:text-xl">
        {t('chat.migration.uploaded_status_of_conversations_and_prompts.text', {
          uploaded: uploaded,
          total: total,
          newLine: '<br />',
        })}
      </p>
      <div className="my-7 h-[1px] w-[80px] bg-controls-disable"></div>
      <p className="text-base md:text-xl">
        {t('chat.migration.not_close_browser_tab.text')}
      </p>
    </div>
  );
};

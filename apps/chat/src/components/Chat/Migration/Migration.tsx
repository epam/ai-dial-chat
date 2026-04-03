import React from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';

import { Spinner } from '@/src/components/Common/Spinner';

interface Props {
  total: number;
  uploaded: number;
}

export const Migration = ({ total, uploaded }: Props) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <Spinner className="h-auto" size={60} />
      <h1 className="mt-7 text-2xl font-semibold md:text-3xl">
        {t(CommonI18nKeys.Migration)}
      </h1>
      <p className="mt-7 text-center text-base md:text-xl">
        {uploaded} {t(CommonI18nKeys.OutOf)} {total} <br />
        {t(CommonI18nKeys.ConversationsAndPromptsAreLoaded)}
      </p>
      <div className="my-7 h-px w-[80px] bg-controls-disable"></div>
      <p className="text-base md:text-xl">
        {t(CommonI18nKeys.NotCloseTheBrowserTab)}
      </p>
    </div>
  );
};

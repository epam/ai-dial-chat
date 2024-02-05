import React from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '../../types/translation';

import ChatLoader from '@/src/components/Chat/ChatLoader';

interface Props {
  total: number;
  uploaded: number;
}

export const Migration = ({ total, uploaded }: Props) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <ChatLoader containerClassName="h-auto" size={60} />
      <h1 className="mt-7 text-2xl font-semibold md:text-3xl">
        {uploaded} {t('out of')} {total}
      </h1>
      <h3 className="mt-2 text-base md:text-xl">
        {t('conversations and prompts are loaded')}
      </h3>
      <div className="my-7 h-[1px] w-[80px] bg-controls-disable"></div>
      <p className="text-base md:text-xl">
        {t('Do not close the browser tab')}
      </p>
    </div>
  );
};

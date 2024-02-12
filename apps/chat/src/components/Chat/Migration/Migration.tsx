import React from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

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
      <p className="mt-7 text-center text-2xl font-semibold md:text-3xl">
        {uploaded} {t('out of')} {total} <br />
        <span className="text-base md:text-xl">
          {t('conversations and prompts are loaded')}
        </span>
      </p>
      <div className="my-7 h-[1px] w-[80px] bg-controls-disable"></div>
      <p className="text-base md:text-xl">
        {t('Do not close the browser tab')}
      </p>
    </div>
  );
};

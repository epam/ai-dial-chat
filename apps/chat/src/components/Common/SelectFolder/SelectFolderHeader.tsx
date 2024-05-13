import React, { ChangeEvent, ReactNode } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { Spinner } from '@/src/components/Common/Spinner';

interface Props {
  handleSearch: (e: ChangeEvent<HTMLInputElement>) => void;
  searchQuery: string;
  children: ReactNode;
  showSpinner?: boolean;
  errorMessage?: string;
}

export const SelectFolderHeader = ({
  handleSearch,
  searchQuery,
  children,
  showSpinner,
  errorMessage,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <>
      {showSpinner ? (
        <div className="flex min-h-[300px] items-center justify-center px-6 pb-4">
          <Spinner />
        </div>
      ) : (
        <div className="group/modal flex flex-col gap-2 overflow-auto px-6 pb-4">
          <ErrorMessage error={errorMessage} />
          <input
            name="titleInput"
            placeholder={t('Search folders') || ''}
            type="text"
            onChange={handleSearch}
            className="m-0 w-full rounded border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-secondary-bg-dark focus-visible:border-accent-primary"
            value={searchQuery}
          />
          {children}
        </div>
      )}
    </>
  );
};

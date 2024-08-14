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
  const { t } = useTranslation(Translation.Common);

  return (
    <>
      {showSpinner ? (
        <div className="flex min-h-[300px] items-center justify-center px-6 pb-4">
          <Spinner />
        </div>
      ) : (
        <div className="select-folder-header group/modal flex flex-col gap-2 overflow-auto px-6 pb-4 text-primary-bg-dark">
          <ErrorMessage error={errorMessage} />
          <input
            name="titleInput"
            placeholder={t('common.input.search_folders') || ''}
            type="text"
            onChange={handleSearch}
            className="m-0 w-full rounded-primary border border-primary bg-transparent px-3 py-2 outline-none placeholder:text-tertiary-bg-light focus-within:border-tertiary hover:border-tertiary hover:shadow-primary focus:outline-none"
            value={searchQuery}
          />
          {children}
        </div>
      )}
    </>
  );
};

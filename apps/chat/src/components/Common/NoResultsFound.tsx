import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import Magnifier from '@/public/images/icons/search-alt.svg';

export const NoResultsFound = () => {
  const { t } = useTranslation(Translation.Common);
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      data-qa="no-data"
    >
      <Magnifier height={60} width={60} className="text-secondary" />
      <span>{t('No results found')}</span>
    </div>
  );
};

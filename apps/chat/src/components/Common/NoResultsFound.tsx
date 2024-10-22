import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import Magnifier from '../../../public/images/icons/search-alt.svg';

interface NoResultsFoundProps {
  iconSize?: number;
  fontSize?: string;
  gap?: string;
}

export const NoResultsFound = ({
  iconSize = 60,
  fontSize = 'text-sm',
  gap = 'gap-3',
}: NoResultsFoundProps) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div
      className={`flex flex-col items-center justify-center ${gap}`}
      data-qa="no-data"
    >
      <Magnifier
        height={iconSize}
        width={iconSize}
        className="text-secondary"
      />
      <span className={`${fontSize}`}>{t('No results found')}</span>
    </div>
  );
};

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import Magnifier from '@/public/images/icons/search-alt.svg';

interface NoResultsFoundProps {
  iconSize?: number;
  className?: string;
}

export const NoResultsFound = ({
  iconSize = 60,
  className = 'text-sm gap-3',
}: NoResultsFoundProps) => {
  const { t } = useTranslation(Translation.Common);

  return (
    <div
      className={classNames(
        'flex flex-col items-center justify-center',
        className,
      )}
      data-qa="no-data"
    >
      <Magnifier
        height={iconSize}
        width={iconSize}
        className="font-semibold text-secondary"
      />
      <span>{t('No results found')}</span>
    </div>
  );
};

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import Magnifier from '@/public/images/icons/search-alt.svg';

interface SuggestedMessageProps {
  entities: DialAIEntityModel[];
  className?: string;
}

export const SuggestedMessage: React.FC<SuggestedMessageProps> = ({
  entities,
  className,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  if (entities.length) {
    return null;
  }

  return (
    <div
      className={classNames(
        'flex flex-col justify-center px-3 md:px-5 xl:px-16',
        className,
      )}
    >
      <div
        className="flex items-center gap-1"
        data-qa="no-workspace-results-found"
      >
        <Magnifier height={32} width={32} className="shrink-0 text-secondary" />
        <span className="text-sm sm:text-base">
          {t(
            'No results found in My workspace. Look at suggested results from DIAL Marketplace.',
          )}
        </span>
      </div>
      <span
        className="mb-4 mt-5 text-xl md:mt-6 lg:mt-8"
        data-qa="marketplace-suggestions-label"
      >
        {t('Suggested results from DIAL Marketplace')}
      </span>
    </div>
  );
};

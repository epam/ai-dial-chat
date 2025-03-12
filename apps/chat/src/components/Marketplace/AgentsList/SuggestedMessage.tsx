import { useTranslation } from 'next-i18next';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import Magnifier from '@/public/images/icons/search-alt.svg';

export const SuggestedMessage: React.FC<{ entities: DialAIEntityModel[] }> = ({
  entities,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  if (entities.length) {
    return null;
  }

  return (
    <div className="flex flex-col justify-center px-3">
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

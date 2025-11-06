import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import {
  ChangeMarketplaceTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { NoResultsFound } from './NoResultsFound';
import { SuggestionButton } from './SuggestionButton';

interface TalkToNotFound {
  isMyWorkspace: boolean;
  onOpenMarketplaceTab: () => void;
}

export const TalkToNotFound = ({
  isMyWorkspace,
  onOpenMarketplaceTab,
}: TalkToNotFound) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <div className="flex size-full items-center justify-center">
      <NoResultsFound
        additionalText={
          isMyWorkspace
            ? t(` in ${ChangeMarketplaceTabs[MarketplaceTabs.MY_WORKSPACE]}`)
            : ''
        }
      >
        {isMyWorkspace && <SuggestionButton onClick={onOpenMarketplaceTab} />}
      </NoResultsFound>
    </div>
  );
};

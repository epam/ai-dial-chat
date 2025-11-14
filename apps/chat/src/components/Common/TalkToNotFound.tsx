import { IconClipboardX } from '@tabler/icons-react';

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
  isSearchMode?: boolean;
}

export const TalkToNotFound = ({
  isMyWorkspace,
  onOpenMarketplaceTab,
  isSearchMode = true,
}: TalkToNotFound) => {
  const { t } = useTranslation(Translation.Chat);

  if (!isSearchMode) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-3">
        <IconClipboardX className="text-secondary" size={60} stroke={0.5} />
        <span>{t('No Agents and Toolsets')}</span>
        {isMyWorkspace && (
          <SuggestionButton
            customText={t('Go to')}
            onSetTab={onOpenMarketplaceTab}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex size-full items-center justify-center">
      <NoResultsFound
        additionalText={
          isMyWorkspace
            ? t(` in ${ChangeMarketplaceTabs[MarketplaceTabs.MY_WORKSPACE]}`)
            : ''
        }
      >
        {isMyWorkspace && <SuggestionButton onSetTab={onOpenMarketplaceTab} />}
      </NoResultsFound>
    </div>
  );
};

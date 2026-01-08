import { useCallback } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import {
  ChangeMarketplaceTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

import { DialButton } from '@epam/ai-dial-ui-kit';

interface SuggestionButtonProps {
  onSetTab?: (tab: MarketplaceTabs) => void;
  customText?: string;
}

export const SuggestionButton = ({
  onSetTab,
  customText = 'See results from',
}: SuggestionButtonProps) => {
  const { t } = useTranslation(Translation.Chat);

  const handleClick = useCallback(() => {
    onSetTab?.(MarketplaceTabs.HOME);
  }, [onSetTab]);

  return (
    <DialButton
      className="text-accent-primary"
      onClick={handleClick}
      label={t('{{baseText}} {{tabName}}', {
        baseText: t(customText),
        tabName: t(ChangeMarketplaceTabs[MarketplaceTabs.HOME]),
      })}
    />
  );
};

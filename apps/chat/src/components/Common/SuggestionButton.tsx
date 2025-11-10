import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import {
  ChangeMarketplaceTabs,
  MarketplaceTabs,
} from '@/src/constants/marketplace';

interface SuggestionButtonProps {
  onSetTab?: (tab: MarketplaceTabs) => void;
  customText?: string;
}

export const SuggestionButton = ({
  onSetTab,
  customText = 'See results from',
}: SuggestionButtonProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <button
      className="text-accent-primary"
      onClick={() => onSetTab?.(MarketplaceTabs.HOME)}
    >
      {t('{{baseText}} {{tabName}}', {
        baseText: t(customText),
        tabName: t(ChangeMarketplaceTabs[MarketplaceTabs.HOME]),
      })}
    </button>
  );
};

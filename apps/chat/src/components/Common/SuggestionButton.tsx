import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { ChangeAgentTabs, MarketplaceTabs } from '@/src/constants/marketplace';

interface SuggestionButtonProps {
  onClick?: () => void;
}

export const SuggestionButton = ({ onClick }: SuggestionButtonProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <button className="text-accent-primary" onClick={onClick}>
      {t(`See results from ${ChangeAgentTabs[MarketplaceTabs.HOME]}`)}
    </button>
  );
};

import React from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { DialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ChangeAgentTabs, MarketplaceTabs } from '@/src/constants/marketplace';

import { AgentAndToolset } from '@/src/components/AppsEditor/Settings/form';
import { ItemCardView } from '@/src/components/Chat/TalkTo/ItemCardView';
import { NoResultsFound } from '@/src/components/Common/NoResultsFound';

export interface AgentAndToolsetSelectItemPassthroughProps {
  selectedItems: AgentAndToolset[];
  onToggleSelectItem: (item: AgentAndToolset) => void;
}

interface AgentAndToolsetSelectItemOwnProps {
  groupItem: AgentAndToolset;
}

export type AgentAndToolsetSelectItemProps =
  AgentAndToolsetSelectItemPassthroughProps & AgentAndToolsetSelectItemOwnProps;

export const AgentAndToolsetSelectItem = ({
  groupItem,
  selectedItems,
  onToggleSelectItem,
}: AgentAndToolsetSelectItemProps) => {
  const isSelected = selectedItems.some(
    (selected) => selected.id === groupItem.id,
  );

  return (
    <ItemCardView
      entity={groupItem as DialAIEntityModel}
      isSelected={isSelected}
      onClick={() => onToggleSelectItem(groupItem)}
      className="bg-layer-3 hover:border-hover active:border-accent-primary"
    />
  );
};

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
            ? t(` in ${ChangeAgentTabs[MarketplaceTabs.MY_WORKSPACE]}`)
            : ''
        }
      >
        {isMyWorkspace && <SuggestionButton onClick={onOpenMarketplaceTab} />}
      </NoResultsFound>
    </div>
  );
};

interface SuggestionButtonProps {
  onClick?: () => void;
}

const SuggestionButton = ({ onClick }: SuggestionButtonProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <button className="text-accent-primary" onClick={onClick}>
      {t(`See results from ${ChangeAgentTabs[MarketplaceTabs.HOME]}`)}
    </button>
  );
};

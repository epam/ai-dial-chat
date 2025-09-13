import React from 'react';

import { getEntityBaseId } from '@/src/utils/app/common';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';

import { ItemCardView } from '@/src/components/Chat/TalkTo/ItemCardView';

export interface AgentAndToolsetSelectItemProps {
  groupItem: MarketplaceEntity;
  selectedBaseIdsSet: Set<string>;
  onToggleSelectItem: (item: MarketplaceEntity) => void;
}

export const AgentAndToolsetSelectItem: React.FC<
  AgentAndToolsetSelectItemProps
> = ({ groupItem, selectedBaseIdsSet, onToggleSelectItem }) => {
  const currentBaseId = getEntityBaseId(groupItem.id);
  const isSelected = selectedBaseIdsSet.has(currentBaseId);

  return (
    <ItemCardView
      entity={groupItem as DialAIEntityModel}
      isSelected={isSelected}
      onClick={onToggleSelectItem}
      hasContextMenu={false}
      selectedBaseIdsSet={selectedBaseIdsSet}
      className="bg-layer-3 hover:border-hover active:border-accent-primary"
    />
  );
};

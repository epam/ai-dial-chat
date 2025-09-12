import React from 'react';

import { isToolsetEntityModel } from '@/src/utils/app/toolsets';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { ItemCardView } from '@/src/components/Chat/TalkTo/ItemCardView';

export interface AgentAndToolsetSelectItemProps {
  groupItem: MarketplaceEntity;
  selectedIdsSet: Set<string>;
  onToggleSelectItem: (item: MarketplaceEntity) => void;
}

export const AgentAndToolsetSelectItem: React.FC<
  AgentAndToolsetSelectItemProps
> = ({ groupItem, selectedIdsSet, onToggleSelectItem }) => {
  const isSelected = selectedIdsSet.has(groupItem.id);

  return (
    <ItemCardView
      entity={groupItem}
      isSelected={isSelected}
      onClick={onToggleSelectItem}
      hasContextMenu={isToolsetEntityModel(groupItem)}
      className="bg-layer-3 hover:border-hover active:border-accent-primary"
    />
  );
};

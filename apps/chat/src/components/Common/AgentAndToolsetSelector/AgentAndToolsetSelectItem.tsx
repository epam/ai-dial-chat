import React from 'react';

import { getEntityBaseId } from '@/src/utils/app/common';
import { isToolsetEntityModel } from '@/src/utils/app/toolsets';

import { MarketplaceEntity } from '@/src/types/marketplace';

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
      entity={groupItem}
      isSelected={isSelected}
      onClick={onToggleSelectItem}
      hasContextMenu={isToolsetEntityModel(groupItem)}
      selectedBaseIdsSet={selectedBaseIdsSet}
      className="bg-layer-2 hover:bg-layer-3 active:border-accent-primary"
    />
  );
};

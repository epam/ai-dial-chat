import React from 'react';

import { MarketplaceEntity } from '@/src/types/marketplace';
import { DialAIEntityModel } from '@/src/types/models';

import { ItemCardView } from '@/src/components/Chat/TalkTo/ItemCardView';

export interface AgentAndToolsetSelectItemProps {
  selectedItems: MarketplaceEntity[];
  onToggleSelectItem: (item: MarketplaceEntity) => void;
  onSelectModel: (entity: DialAIEntityModel) => void;
  groupItem: MarketplaceEntity;
}

export const AgentAndToolsetSelectItem = ({
  groupItem,
  selectedItems,
  onToggleSelectItem,
  onSelectModel,
}: AgentAndToolsetSelectItemProps) => {
  const isSelected = selectedItems.some(
    (selected) => selected.id === groupItem.id,
  );

  return (
    <ItemCardView
      entity={groupItem as DialAIEntityModel}
      isSelected={isSelected}
      onClick={onToggleSelectItem}
      onSelectVersion={onSelectModel}
      className="bg-layer-3 hover:border-hover active:border-accent-primary"
    />
  );
};

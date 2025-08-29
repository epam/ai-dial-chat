import React from 'react';

import { DialAIEntityModel } from '@/src/types/models';

import { AgentAndToolset } from '@/src/components/AppsEditor/Settings/form';
import { ItemCardView } from '@/src/components/Chat/TalkTo/ItemCardView';

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

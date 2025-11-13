import { useCallback } from 'react';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { OverflowContainer } from '../OverflowContainer';
import { AgentAndToolsetChip } from './AgentAndToolsetChip';
import { OverflowButton } from './OverflowButton';
import { OverflowListItem } from './OverflowListItem';

interface SelectedItemsContainerProps {
  selectedIds: string[];
  allItemsMap: Record<string, MarketplaceEntity | undefined>;
  onRemove: (id: string) => void;
  onItemClick?: (id: string) => void;
}

const OVERFLOW_BUTTON_WIDTH = 50;

const getKey = (item: { id: string }) => item.id;

export const SelectedItemsContainer = ({
  selectedIds,
  allItemsMap,
  onRemove,
  onItemClick,
}: SelectedItemsContainerProps) => {
  const items = selectedIds.map((id) => ({
    id,
    data: allItemsMap[id],
  }));

  const renderItem = useCallback(
    (item: { id: string; data: MarketplaceEntity | undefined }) => (
      <AgentAndToolsetChip
        id={item.id}
        item={item.data}
        onRemove={onRemove}
        onItemClick={onItemClick}
        isInSelectionList
      />
    ),
    [onRemove, onItemClick],
  );

  const renderOverflow = useCallback(
    (hiddenItems: { id: string; data: MarketplaceEntity | undefined }[]) => (
      <OverflowButton
        hiddenItems={hiddenItems}
        onRemove={onRemove}
        onItemClick={onItemClick}
        ItemComponent={OverflowListItem}
      />
    ),
    [onItemClick, onRemove],
  );

  return (
    <OverflowContainer
      items={items}
      getKey={getKey}
      overflowIndicatorWidth={OVERFLOW_BUTTON_WIDTH}
      renderItem={renderItem}
      renderOverflow={renderOverflow}
    />
  );
};

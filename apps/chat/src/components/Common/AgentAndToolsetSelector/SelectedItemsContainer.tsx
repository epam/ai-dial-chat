import { MarketplaceEntity } from '@/src/types/marketplace';

import { OverflowContainer } from '../OverflowContainer';
import { AgentAndToolsetChip } from './AgentAndToolsetChip';
import { OverflowButton } from './OverflowButton';
import { OverflowListItem } from './OverflowListItem';

interface SelectedItemsContainerProps {
  selectedIds: string[];
  allItemsMap: Record<string, MarketplaceEntity | undefined>;
  onRemove: (id: string) => void;
}

const OVERFLOW_BUTTON_WIDTH = 50;

export const SelectedItemsContainer = ({
  selectedIds,
  allItemsMap,
  onRemove,
}: SelectedItemsContainerProps) => {
  const validItems = selectedIds.flatMap((id) => {
    const data = allItemsMap[id];

    if (data) {
      return [{ id, data }];
    }

    return [];
  });

  return (
    <OverflowContainer
      items={validItems}
      getKey={(item) => item.id}
      overflowIndicatorWidth={OVERFLOW_BUTTON_WIDTH}
      renderItem={(item) => (
        <AgentAndToolsetChip
          id={item.id}
          item={item.data}
          onRemove={onRemove}
        />
      )}
      renderOverflow={(hiddenItems) => (
        <OverflowButton<MarketplaceEntity>
          hiddenItems={hiddenItems}
          onRemove={onRemove}
          ItemComponent={OverflowListItem}
        />
      )}
    />
  );
};

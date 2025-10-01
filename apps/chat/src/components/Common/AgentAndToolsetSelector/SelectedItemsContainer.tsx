import { MarketplaceEntity } from '@/src/types/marketplace';

import { OverflowContainer } from '../OverflowContainer';
import { AgentAndToolsetChip } from './AgentAndToolsetChip';
import { OverflowButton } from './OverflowButton';

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
  const validItems = selectedIds
    .map((id) => ({ id, data: allItemsMap[id] }))
    .filter(
      (item): item is { id: string; data: MarketplaceEntity } => !!item.data,
    );

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
        <OverflowButton hiddenItems={hiddenItems} onRemove={onRemove} />
      )}
    />
  );
};

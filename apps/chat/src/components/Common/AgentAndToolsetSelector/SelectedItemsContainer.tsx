import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useResizeObserver } from '@/src/hooks/useResizeObserver';

import { MarketplaceEntity } from '@/src/types/marketplace';

import { AgentAndToolsetChip } from './AgentAndToolsetChip';
import { OverflowButton } from './OverflowButton';

interface SelectedItemsContainerProps {
  selectedIds: string[];
  allItemsMap: Record<string, MarketplaceEntity | undefined>;
  onRemove: (id: string) => void;
}

const GAP_WIDTH = 8;
const OVERFLOW_BUTTON_WIDTH = 50;

export const SelectedItemsContainer = ({
  selectedIds,
  allItemsMap,
  onRemove,
}: SelectedItemsContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [visibleCount, setVisibleCount] = useState(selectedIds.length);

  const validItems = selectedIds
    .map((id) => ({ id, data: allItemsMap[id] }))
    .filter(
      (item): item is { id: string; data: MarketplaceEntity } => !!item.data,
    );

  const recalculateVisibleCount = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.offsetWidth;
    let totalWidth = 0;
    for (let i = 0; i < validItems.length; i++) {
      const itemNode = itemRefs.current[i];
      if (itemNode) {
        totalWidth += itemNode.offsetWidth + (i > 0 ? GAP_WIDTH : 0);
      }
    }

    if (totalWidth <= containerWidth) {
      setVisibleCount(validItems.length);
      return;
    }

    const availableWidth = containerWidth - OVERFLOW_BUTTON_WIDTH;
    let currentWidth = 0;
    let newVisibleCount = 0;
    for (let i = 0; i < validItems.length; i++) {
      const itemNode = itemRefs.current[i];
      if (!itemNode) continue;

      const itemWidth = itemNode.offsetWidth + (i > 0 ? GAP_WIDTH : 0);
      if (currentWidth + itemWidth > availableWidth) break;

      currentWidth += itemWidth;
      newVisibleCount++;
    }
    setVisibleCount(newVisibleCount);
  }, [validItems.length]);

  useResizeObserver(containerRef.current, recalculateVisibleCount);

  useLayoutEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, validItems.length);
    recalculateVisibleCount();
  }, [validItems, recalculateVisibleCount]);

  const visibleItems = validItems.slice(0, visibleCount);
  const hiddenItems = validItems.slice(visibleCount);

  return (
    <div
      ref={containerRef}
      className="flex w-full flex-nowrap items-center gap-2"
    >
      {visibleItems.map(({ id, data }, index) => (
        <div key={id} ref={(el) => (itemRefs.current[index] = el)}>
          <AgentAndToolsetChip id={id} item={data} onRemove={onRemove} />
        </div>
      ))}

      <div className="absolute -z-50 flex opacity-0">
        {hiddenItems.map(({ id, data }, index) => (
          <div
            key={id}
            ref={(el) => (itemRefs.current[visibleCount + index] = el)}
          >
            <AgentAndToolsetChip id={id} item={data} onRemove={onRemove} />
          </div>
        ))}
      </div>

      {hiddenItems.length > 0 && (
        <OverflowButton hiddenItems={hiddenItems} onRemove={onRemove} />
      )}
    </div>
  );
};

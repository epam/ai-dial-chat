import React, {
  ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useResizeObserver } from '@/src/hooks/useResizeObserver';

const GAP_WIDTH = 8;
const EDGE_SAFETY_MARGIN = 4;

interface OverflowContainerProps<T> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  renderOverflow: (hiddenItems: T[]) => ReactNode;
  getKey: (item: T) => string | number;
  overflowIndicatorWidth?: number;
  trailingReservedWidth?: number;
  className?: string;
  dataQA?: string;
}

export function OverflowContainer<T>({
  items,
  renderItem,
  renderOverflow,
  getKey,
  overflowIndicatorWidth = 50,
  trailingReservedWidth = 0,
  className = 'flex w-full flex-nowrap items-center gap-1',
  dataQA,
}: OverflowContainerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const [visibleItems, setVisibleItems] = useState<T[]>([]);
  const [hiddenItems, setHiddenItems] = useState<T[]>([]);

  const recalculateItems = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = Math.max(
      container.offsetWidth - trailingReservedWidth - EDGE_SAFETY_MARGIN,
      0,
    );

    let totalWidth = 0;
    for (let i = 0; i < items.length; i++) {
      const itemNode = itemRefs.current[i];
      if (itemNode) {
        totalWidth += itemNode.offsetWidth + (i > 0 ? GAP_WIDTH : 0);
      }
    }

    if (totalWidth <= containerWidth) {
      setVisibleItems(items);
      setHiddenItems([]);
      return;
    }

    const availableWidth = containerWidth - overflowIndicatorWidth - GAP_WIDTH;
    let occupiedWidth = 0;
    const newVisibleItems: T[] = [];
    const newHiddenItems: T[] = [];

    items.forEach((item, index) => {
      const itemNode = itemRefs.current[index];
      if (!itemNode) {
        newHiddenItems.push(item);
        return;
      }

      const itemWidth = itemNode.offsetWidth;
      const widthWithGap =
        (newVisibleItems.length > 0 ? GAP_WIDTH : 0) + itemWidth;

      if (occupiedWidth + widthWithGap <= availableWidth) {
        occupiedWidth += widthWithGap;
        newVisibleItems.push(item);
      } else {
        newHiddenItems.push(item);
      }
    });

    setVisibleItems(newVisibleItems);
    setHiddenItems(newHiddenItems);
  }, [items, overflowIndicatorWidth, trailingReservedWidth]);

  useResizeObserver(containerRef.current, recalculateItems);
  useLayoutEffect(() => {
    recalculateItems();
  }, [recalculateItems]);

  return (
    <>
      <div ref={containerRef} className={className} data-qa={dataQA}>
        {visibleItems.map((item) => (
          <React.Fragment key={getKey(item)}>{renderItem(item)}</React.Fragment>
        ))}
        {hiddenItems.length > 0 && renderOverflow(hiddenItems)}
      </div>

      <div className="absolute left-0 top-0 size-0 overflow-hidden">
        <div className="invisible flex w-max gap-2" aria-hidden="true">
          {items.map((item, index) => (
            <span
              key={getKey(item)}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
            >
              {renderItem(item)}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

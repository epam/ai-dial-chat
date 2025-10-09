import React, {
  ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { useResizeObserver } from '@/src/hooks/useResizeObserver';

const GAP_WIDTH = 8;

interface OverflowContainerProps<T> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  renderOverflow: (hiddenItems: T[]) => ReactNode;
  getKey: (item: T) => string | number;
  overflowIndicatorWidth?: number;
  className?: string;
  dataQA?: string;
}

export function OverflowContainer<T>({
  items,
  renderItem,
  renderOverflow,
  getKey,
  overflowIndicatorWidth = 50,
  className = 'flex w-full flex-nowrap items-center gap-2',
  dataQA,
}: OverflowContainerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const [visibleItems, setVisibleItems] = useState<T[]>([]);
  const [hiddenItems, setHiddenItems] = useState<T[]>([]);

  const recalculateItems = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.offsetWidth;

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

    const availableWidth = containerWidth - overflowIndicatorWidth;
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

    setVisibleItems((currentVisible) => {
      const newKeys = newVisibleItems.map(getKey).join(',');
      const currentKeys = currentVisible.map(getKey).join(',');
      return newKeys === currentKeys ? currentVisible : newVisibleItems;
    });
    setHiddenItems((currentHidden) => {
      const newKeys = newHiddenItems.map(getKey).join(',');
      const currentKeys = currentHidden.map(getKey).join(',');
      return newKeys === currentKeys ? currentHidden : newHiddenItems;
    });
  }, [items, overflowIndicatorWidth, getKey]);

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

      <div
        className="invisible fixed top-0 flex w-max gap-2"
        aria-hidden="true"
      >
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
    </>
  );
}

import { mergeClasses, PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { DialSkeleton, DialSkeletonAvatarShape } from '@epam/ai-dial-ui-kit';
import { type FC, memo, useMemo } from 'react';
import { CARD_HEIGHT, SKELETON_ROW_COUNT } from '../../constants/virtual-grid';
import type { CardRowData } from '../../models/card-row-data';
import type { CardGridProps } from '../../models/grid-props';
import { useScrollVirtualizer } from '../../utils/use-scroll-virtualizer';
import styles from './CardGrid.module.scss';
import { CardRowRenderer } from './CardRowRenderer';

/** Three-column virtualized grid of Card items with loading skeleton and empty state. */
export const CardGrid: FC<CardGridProps> = memo(
  ({ items, query = '', onToggleFavorite, onItemClick, titles, isLoading }) => {
    const noResultsTitle = titles?.noResultsTitle ?? 'No results';
    const featuredLabel = titles?.featuredLabel ?? 'Featured';

    const { containerRef, startRow, endRow, columnCount, totalHeight } =
      useScrollVirtualizer(items.length);

    const rowData = useMemo<CardRowData>(
      () => ({
        items,
        columnCount,
        query,
        onToggleFavorite,
        onItemClick,
        featuredLabel,
      }),
      [items, columnCount, query, onToggleFavorite, onItemClick, featuredLabel],
    );

    if (isLoading) {
      return (
        <div
          className="grid gap-5 p-5"
          style={{
            gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: columnCount * SKELETON_ROW_COUNT }, (_, i) => (
            <div
              key={i}
              className={mergeClasses(
                'rounded-[6px] border p-4',
                styles.skeletonCard,
              )}
              style={{ height: CARD_HEIGHT }}
            >
              <DialSkeleton
                avatar={{ size: 48, shape: DialSkeletonAvatarShape.Square }}
                showTitle={{ width: `${60 + ((i * 17) % 30)}%` }}
                paragraph={{ rows: 3 }}
                active
                color="var(--cat-skeleton-bg)"
              />
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex w-full flex-col items-center justify-center gap-2 py-20">
          <PanelEmptyState label={noResultsTitle} icon={null} />
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative"
        style={{ height: totalHeight }}
      >
        {Array.from({ length: endRow - startRow }, (_, i) => {
          const rowIndex = startRow + i;
          return (
            <CardRowRenderer key={rowIndex} rowIndex={rowIndex} {...rowData} />
          );
        })}
      </div>
    );
  },
);

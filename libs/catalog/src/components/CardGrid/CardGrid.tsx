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
  ({
    items,
    query = '',
    onToggleFavorite,
    onItemClick,
    titles,
    isLoading,
    selectedItemId,
  }) => {
    const noResultsTitle = titles?.noResultsTitle ?? 'No results';
    const featuredLabel = titles?.featuredLabel ?? 'Featured';
    const addToFavoritesAriaLabel =
      titles?.addToFavoritesAriaLabel ?? 'Add to favorites';
    const removeFromFavoritesAriaLabel =
      titles?.removeFromFavoritesAriaLabel ?? 'Remove from favorites';
    const credentialsBadgeLoggedOutLabel =
      titles?.credentialsBadgeLoggedOutLabel ?? 'LOGGED OUT';

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
        addToFavoritesAriaLabel,
        removeFromFavoritesAriaLabel,
        selectedItemId,
        credentialsBadgeLoggedOutLabel,
      }),
      [
        items,
        columnCount,
        query,
        onToggleFavorite,
        onItemClick,
        featuredLabel,
        addToFavoritesAriaLabel,
        removeFromFavoritesAriaLabel,
        selectedItemId,
        credentialsBadgeLoggedOutLabel,
      ],
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
                color="var(--bg-layer-4)"
              />
            </div>
          ))}
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex size-full flex-col items-center justify-center">
          <PanelEmptyState label={noResultsTitle} />
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

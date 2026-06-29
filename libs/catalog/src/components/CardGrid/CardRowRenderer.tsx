import { type CSSProperties, type ReactElement } from 'react';
import { CARD_ROW_HEIGHT } from '../../constants/virtual-grid';
import type { CardRowData } from '../../models/card-row-data';
import { Card } from './Card';

/** Props for a single virtual row in the card grid. */
export interface CardRowRendererProps extends CardRowData {
  /** Zero-based row index used to slice the correct items and set vertical position. */
  rowIndex: number;
}

/**
 * Renders a single absolutely-positioned row of up to `columnCount` cards.
 * Empty column slots in the last row are filled with invisible spacer divs
 * so that earlier cards keep their flex-1 width.
 */
export const CardRowRenderer = ({
  rowIndex,
  items,
  columnCount,
  query,
  onToggleFavorite,
  onItemClick,
  featuredLabel,
}: CardRowRendererProps): ReactElement => {
  const start = rowIndex * columnCount;
  const rowItems = items.slice(start, start + columnCount);

  const style: CSSProperties = {
    position: 'absolute',
    top: rowIndex * CARD_ROW_HEIGHT,
    width: '100%',
    height: CARD_ROW_HEIGHT,
  };

  return (
    <div style={style} className="flex gap-4 pb-4">
      {Array.from({ length: columnCount }, (_, colIndex) => {
        const item = rowItems[colIndex];
        return (
          <div
            key={item?.id ?? `spacer-${colIndex}`}
            className="h-full min-w-0 flex-1"
          >
            {item && (
              <Card
                item={item}
                query={query}
                initialIsStarred={item.isStarred}
                onToggle={onToggleFavorite}
                onClick={onItemClick}
                featuredLabel={featuredLabel}
                className="h-full"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

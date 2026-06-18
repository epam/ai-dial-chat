import { mergeClasses, PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { FC } from 'react';
import type { CatalogCardGridProps } from '../../models/card-grid-props';
import { CatalogCard } from './CatalogCard';
import styles from './CatalogCardGrid.module.scss';

/** Three-column grid of CatalogCard items, with an empty state when there are no results. */
export const CatalogCardGrid: FC<CatalogCardGridProps> = ({
  items,
  query = '',
  onToggleFavorite,
  titles,
}) => {
  const noResultsTitle = titles?.noResultsTitle ?? 'No results';
  const featuredLabel = titles?.featuredLabel ?? 'Featured';

  if (items.length > 0) {
    return (
      <div className="small_tablet:grid-cols-2 grid w-full grid-cols-1 gap-5 desktop:grid-cols-3">
        {items.map((item) => (
          <CatalogCard
            key={item.id}
            item={item}
            query={query}
            onToggle={onToggleFavorite}
            featuredLabel={featuredLabel}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 py-20">
      <PanelEmptyState label={noResultsTitle} icon={null} />
    </div>
  );
};

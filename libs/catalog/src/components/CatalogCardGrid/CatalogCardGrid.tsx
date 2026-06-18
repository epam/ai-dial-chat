import { mergeClasses } from '@epam/ai-dial-chat-shared';
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
  styles: cardGridStyles,
}) => {
  const noResultsTitle = titles?.noResultsTitle ?? 'No results';
  const noResultsDescription =
    titles?.noResultsDescription ?? 'Try a different keyword';
  const featuredLabel = titles?.featuredLabel ?? 'Featured';
  const noResultsTitleClassName =
    cardGridStyles?.noResultsTitleClassName ?? 'dial-h3-text';
  const noResultsDescriptionClassName =
    cardGridStyles?.noResultsDescriptionClassName ?? 'dial-small-text';

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

  // TODO: add empty state icon
  return (
    <div className="flex w-full flex-col items-center justify-center gap-2 py-20">
      <span
        className={mergeClasses(noResultsTitleClassName, styles.emptyTitle)}
      >
        {noResultsTitle}
      </span>
      <span
        className={mergeClasses(
          noResultsDescriptionClassName,
          styles.emptyDescription,
        )}
      >
        {noResultsDescription}
      </span>
    </div>
  );
};

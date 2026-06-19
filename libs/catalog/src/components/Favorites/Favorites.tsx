import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DialPagination } from '@epam/ai-dial-ui-kit';
import { type CSSProperties, FC, useState } from 'react';
import { FavoritesProps } from '../../models/favorites';
import { useFavColumns } from '../../utils/use-fav-columns';
import { ItemHeader } from '../ItemHeader/ItemHeader';
import { FavoriteCard } from './FavoriteCard';
import styles from './Favorites.module.scss';

/** Number of rows shown in the Favorites grid per page. */
const FAV_ROWS = 2;

/**
 * Favorites strip with responsive grid, pagination, and a fade-in animation.
 * Column count adapts to viewport width via `useFavColumns`.
 */
export const Favorites: FC<FavoritesProps> = ({
  items,
  totalCount,
  title = 'Your Favorites',
  onToggleFavorite,
  styles: favoritesStyles,
}) => {
  const titleClassName =
    favoritesStyles?.typography?.titleClassName ?? 'dial-h3-text';
  const countClassName =
    favoritesStyles?.typography?.countClassName ?? 'dial-tiny-text';
  const cssVars = {
    '--cat-favorites-bg-base': favoritesStyles?.colors?.backgroundBase,
    '--cat-favorites-bg-start': favoritesStyles?.colors?.backgroundStart,
    '--cat-favorites-bg-end': favoritesStyles?.colors?.backgroundEnd,
    '--cat-favorites-border': favoritesStyles?.colors?.border,
    '--cat-favorites-title-text': favoritesStyles?.colors?.titleText,
    '--cat-favorites-count-text': favoritesStyles?.colors?.countText,
  } as CSSProperties;

  const [favPage, setFavPage] = useState(1);
  const favColumns = useFavColumns();
  const favPerPage = favColumns * FAV_ROWS;
  const favStart = (favPage - 1) * favPerPage;
  const favSlice = items.slice(favStart, favStart + favPerPage);
  const favTotalPages = Math.ceil(items.length / favPerPage);
  const displayCount = totalCount ?? items.length;

  return (
    <section
      className={mergeClasses(
        'flex-shrink-0 border-b px-6 pt-6',
        styles.section,
      )}
      style={cssVars}
    >
      <ItemHeader
        title={title}
        count={displayCount}
        titleClassName={titleClassName}
        countClassName={countClassName}
        className="mb-4"
      />

      <div
        key={favPage}
        className={mergeClasses('grid gap-x-6 gap-y-5', styles.gridPage)}
        style={{ gridTemplateColumns: `repeat(${favColumns}, minmax(0, 1fr))` }}
      >
        {favSlice.map((item) => (
          <FavoriteCard key={item.id} item={item} onToggle={onToggleFavorite} />
        ))}

        {/* Invisible placeholders keep the grid height constant across pages. */}
        {Array.from({ length: favPerPage - favSlice.length }).map(
          (_, index) => (
            <div key={`ph-${index}`} className="invisible" aria-hidden>
              {items[0] && <FavoriteCard item={items[0]} />}
            </div>
          ),
        )}
      </div>

      <div className="flex justify-center py-4">
        {favTotalPages > 1 && (
          <DialPagination
            page={favPage}
            totalPages={favTotalPages}
            onPageChange={setFavPage}
          />
        )}
      </div>
    </section>
  );
};

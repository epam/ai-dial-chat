import { DialPagination } from '@epam/ai-dial-ui-kit';
import { type CSSProperties, FC, useState } from 'react';
import type { FavoriteItem } from '../../models/catalog-item';
import { useFavColumns } from '../../utils/use-fav-columns';
import { FavoriteCard } from '../FavoriteCard/FavoriteCard';
import styles from './CatalogFavorites.module.scss';

/** Number of rows shown in the Favorites grid per page. */
const FAV_ROWS = 2;

/** Typography class overrides for `CatalogFavorites`. */
export interface CatalogFavoritesTypography {
  /** Typography class for the section title. Default: `'dial-h3-text'`. */
  titleClassName?: string;
  /** Typography class for the total count. Default: `'dial-tiny-text'`. */
  countClassName?: string;
}

/** Color overrides for `CatalogFavorites`, applied via CSS custom properties. */
export interface CatalogFavoritesColors {
  /** Base section background color. Fallback: `--bg-layer-1`. */
  backgroundBase?: string;
  /** Favorites gradient start color. Fallback: `--bg-accent-tertiary-alpha`. */
  backgroundStart?: string;
  /** Favorites gradient end color. Fallback: `--bg-accent-primary-alpha`. */
  backgroundEnd?: string;
  /** Section bottom border color. Fallback: `--stroke-secondary`. */
  border?: string;
  /** Section title color. Fallback: `--text-primary`. */
  titleText?: string;
  /** Count text color. Fallback: `--text-secondary`. */
  countText?: string;
}

/** Grouped style overrides for `CatalogFavorites`. */
export interface CatalogFavoritesStyles {
  /** Typography class overrides for title and count. */
  typography?: CatalogFavoritesTypography;
  /** Color overrides applied as CSS custom properties. */
  colors?: CatalogFavoritesColors;
}

/** Props for `CatalogFavorites`. */
export interface CatalogFavoritesProps {
  /** Favorite items to paginate and display. */
  items: FavoriteItem[];
  /** Total favorites count shown in the heading (may exceed items.length). Default: items.length. */
  totalCount?: number;
  /** Section heading text. Default: 'Your Favorites'. */
  title?: string;
  /** Called when a favorite card's star is toggled. */
  onToggleFavorite?: (id: string, isStarred: boolean) => void;
  /** Grouped typography and color overrides for the section. */
  styles?: CatalogFavoritesStyles;
}

/**
 * Favorites strip with responsive grid, pagination, and a fade-in animation.
 * Column count adapts to viewport width via `useFavColumns`.
 */
export const CatalogFavorites: FC<CatalogFavoritesProps> = ({
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
      className={['flex-shrink-0 border-b px-6 pt-6', styles.section].join(' ')}
      style={cssVars}
    >
      <div className="mb-4 flex items-center gap-2">
        <h2 className={['m-0', titleClassName, styles.title].join(' ')}>
          {title}
        </h2>
        <span className={[countClassName, styles.count].join(' ')}>
          {displayCount}
        </span>
      </div>

      <div
        key={favPage}
        className={['grid gap-x-6 gap-y-5', styles.gridPage].join(' ')}
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

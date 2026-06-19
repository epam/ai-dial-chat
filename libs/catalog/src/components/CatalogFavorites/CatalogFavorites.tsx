import { DialPagination } from '@epam/ai-dial-ui-kit';
import {
  type CSSProperties,
  FC,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { FavoriteItem } from '../../models/CatalogItem';
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

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)),
    [items],
  );

  const [favPage, setFavPage] = useState(1);
  const favColumns = useFavColumns();
  const favPerPage = favColumns * FAV_ROWS;
  const favStart = (favPage - 1) * favPerPage;
  const favSlice = sortedItems.slice(favStart, favStart + favPerPage);
  const favTotalPages = Math.ceil(sortedItems.length / favPerPage);
  const displayCount = totalCount ?? items.length;

  // Lock the grid height to its page-1 size so that shorter last pages don't
  // cause a layout shift. Measured after the first full-page render via
  // useLayoutEffect (fires before paint → no visible flash).
  const gridRef = useRef<HTMLDivElement>(null);
  const [lockedGridHeight, setLockedGridHeight] = useState<
    number | undefined
  >();
  const prevColumnsRef = useRef(favColumns);

  // When the column count changes (viewport resize), go back to page 1 and
  // re-measure so the locked height stays accurate.
  useEffect(() => {
    if (prevColumnsRef.current === favColumns) return;
    prevColumnsRef.current = favColumns;
    setFavPage(1);
    setLockedGridHeight(undefined);
  }, [favColumns]);

  // Capture height while on the first (full) page; skip if already locked.
  useLayoutEffect(() => {
    if (
      !gridRef.current ||
      favTotalPages <= 1 ||
      favPage !== 1 ||
      lockedGridHeight !== undefined
    )
      return;
    // offsetHeight is transform-unaware; getBoundingClientRect() would return the
    // scaled value during the favFadeIn animation and produce a ~3% under-count.
    setLockedGridHeight(gridRef.current.offsetHeight);
  }, [favTotalPages, favPage, lockedGridHeight]);

  return (
    <section
      className={['flex-shrink-0 border-b px-6 pb-6 pt-6', styles.section].join(
        ' ',
      )}
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
        ref={gridRef}
        className={['grid content-start gap-x-6 gap-y-5', styles.gridPage].join(
          ' ',
        )}
        style={{
          gridTemplateColumns: `repeat(${favColumns}, minmax(0, 1fr))`,
          minHeight: lockedGridHeight,
        }}
      >
        {favSlice.map((item) => (
          <FavoriteCard key={item.id} item={item} onToggle={onToggleFavorite} />
        ))}
      </div>

      {favTotalPages > 1 && (
        <div
          className={['flex justify-center py-4', styles.paginationRow].join(
            ' ',
          )}
        >
          <DialPagination
            page={favPage}
            totalPages={favTotalPages}
            onPageChange={setFavPage}
          />
        </div>
      )}
    </section>
  );
};

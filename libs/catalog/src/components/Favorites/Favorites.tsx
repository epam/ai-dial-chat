import { mergeClasses } from '@epam/ai-dial-chat-shared';
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
      className={mergeClasses(
        'flex-shrink-0 border-b px-6 py-6',
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
        ref={gridRef}
        className={mergeClasses(
          'grid content-start gap-x-6 gap-y-5',
          styles.gridPage,
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
          className={mergeClasses(
            'flex justify-center py-4',
            styles.paginationRow,
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

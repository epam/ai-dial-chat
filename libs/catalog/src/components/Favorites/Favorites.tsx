import {
  buildCssVars,
  ItemHeader,
  mergeClasses,
  useIsMobile,
} from '@epam/ai-dial-chat-shared';
import {
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import {
  FC,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FavoritesProps } from '../../models/favorites';
import {
  getRowActiveIndex,
  getRowScrollDelta,
} from '../../utils/favorites-row';
import { useFavColumns } from '../../utils/use-fav-columns';
import { FavoriteCard } from './FavoriteCard';
import styles from './Favorites.module.scss';

/** Number of rows shown in the Favorites grid per page. */
const FAV_ROWS = 2;

/**
 * Returns the element's page-absolute bounding rect with any CSS transforms
 * subtracted, giving a scroll-invariant layout position for FLIP comparisons.
 * Uses page-absolute coords (rect + scrollX/Y) so that storing positions at
 * scroll=0 and reading them at scroll=400 gives the same page_y, keeping
 * FLIP deltas correct regardless of where the user scrolled.
 */
const getLayoutRect = (el: HTMLElement): DOMRect => {
  const rect = el.getBoundingClientRect();
  const sx = window.scrollX;
  const sy = window.scrollY;
  const transform = window.getComputedStyle(el).transform;
  if (!transform || transform === 'none') {
    return new DOMRect(rect.x + sx, rect.y + sy, rect.width, rect.height);
  }
  try {
    const { m41: tx, m42: ty } = new DOMMatrix(transform);
    return new DOMRect(
      rect.x - tx + sx,
      rect.y - ty + sy,
      rect.width,
      rect.height,
    );
  } catch {
    return new DOMRect(rect.x + sx, rect.y + sy, rect.width, rect.height);
  }
};

/**
 * Favorites strip: a paginated responsive grid on desktop, a single
 * horizontally scrollable row below the desktop breakpoint.
 */
export const Favorites: FC<FavoritesProps> = ({
  items,
  totalCount,
  title = 'Your Favorites',
  onToggleFavorite,
  isFavoriteVisible,
  onItemClick,
  styles: favoritesStyles,
  isLeaving,
  onExitComplete,
  prevPageAriaLabel = 'Previous page',
  nextPageAriaLabel = 'Next page',
  addToFavoritesAriaLabel,
  removeFromFavoritesAriaLabel,
  selectedItemId,
  credentialsBadgeLoggedOutLabel,
  isPaginationHidden = false,
}) => {
  const titleClassName =
    favoritesStyles?.typography?.titleClassName ?? 'dial-body-semi-text';

  const countClassName =
    favoritesStyles?.typography?.countClassName ?? 'dial-tiny-semi-text';

  const cssVars = buildCssVars({
    '--cat-fav-title-text': favoritesStyles?.colors?.titleText,
    '--cat-fav-count-text': favoritesStyles?.colors?.countText,
    '--cat-fav-selected-check': favoritesStyles?.colors?.selectedCheckIcon,
    '--cat-fav-selected-border': favoritesStyles?.colors?.selectedCardBorder,
    '--cat-fav-selected-bg': favoritesStyles?.colors?.selectedCardBackground,
    '--cat-fav-nav-btn': favoritesStyles?.colors?.navButton,
    '--cat-fav-nav-btn-disabled': favoritesStyles?.colors?.navButtonDisabled,
    '--cat-fav-nav-btn-hover-bg':
      favoritesStyles?.colors?.navButtonHoverBackground,
    '--cat-fav-nav-btn-active-bg':
      favoritesStyles?.colors?.navButtonActiveBackground,
    '--cat-fav-page-nav-border': favoritesStyles?.colors?.pageNavBorder,
    '--cat-fav-page-nav-bg': favoritesStyles?.colors?.pageNavBackground,
  });
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          (new Date(b.updatedAt || '').getTime() ?? 0) -
          (new Date(a.updatedAt || '').getTime() ?? 0),
      ),
    [items],
  );

  const [favPage, setFavPage] = useState(1);
  const favColumns = useFavColumns();
  /* Below the desktop breakpoint every favorite sits in one row the user
   * swipes through; a page is then one card, and the pager scrolls the row. */
  const isRow = useIsMobile();
  const isPaged = !isPaginationHidden && !isRow;
  const favPerPage = favColumns * FAV_ROWS;
  const favStart = (favPage - 1) * favPerPage;
  const favSlice = useMemo(
    () =>
      isPaged
        ? sortedItems.slice(favStart, favStart + favPerPage)
        : sortedItems,
    [isPaged, sortedItems, favStart, favPerPage],
  );
  let favTotalPages = 1;
  if (isPaged) {
    favTotalPages = Math.ceil(sortedItems.length / favPerPage);
  } else if (isRow && !isPaginationHidden) {
    favTotalPages = sortedItems.length;
  }
  const displayCount = totalCount ?? items.length;

  /*
   * Lock both the grid and the section to their page-1 sizes so that shorter
   * last pages don't shift the pagination or jump the section background gradient.
   * Measured after the first full-page render via useLayoutEffect (fires before
   * paint → no visible flash).
   */
  const sectionWrapperRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [lockedGridHeight, setLockedGridHeight] = useState<
    number | undefined
  >();
  const [lockedSectionHeight, setLockedSectionHeight] = useState<
    number | undefined
  >();
  const prevColumnsRef = useRef(favColumns);
  const prevIsRowRef = useRef(isRow);

  /*
   * When the column count or the row/grid layout changes (viewport resize),
   * go back to page 1 and re-measure so the locked heights stay accurate.
   */
  useEffect(() => {
    if (prevColumnsRef.current === favColumns && prevIsRowRef.current === isRow)
      return;
    prevColumnsRef.current = favColumns;
    prevIsRowRef.current = isRow;
    setFavPage(1);
    setLockedGridHeight(undefined);
    setLockedSectionHeight(undefined);
  }, [favColumns, isRow]);

  /*
   * Reset to the last valid page when items are removed and the current page
   * no longer exists (e.g. deleting the only card on page 2).
   */
  useEffect(() => {
    if (favPage > favTotalPages && favTotalPages > 0) {
      setFavPage(favTotalPages);
    }
  }, [favPage, favTotalPages]);

  /*
   * Release the height lock once items reduce to a single page so the
   * section can shrink (the FLIP effect will animate the height change).
   */
  useEffect(() => {
    if (
      favTotalPages <= 1 &&
      (lockedGridHeight !== undefined || lockedSectionHeight !== undefined)
    ) {
      setLockedGridHeight(undefined);
      setLockedSectionHeight(undefined);
    }
  }, [favTotalPages, lockedGridHeight, lockedSectionHeight]);

  /* Capture both heights while on the first (full) page; skip if already
   * locked. A row is one card tall on every page, so it never needs the lock. */
  useLayoutEffect(() => {
    if (
      !gridRef.current ||
      !sectionRef.current ||
      isRow ||
      favTotalPages <= 1 ||
      favPage !== 1 ||
      lockedGridHeight !== undefined
    )
      return;
    /*
     * offsetHeight is transform-unaware; getBoundingClientRect() would return the
     * scaled value during the favFadeIn animation and produce a ~3% under-count.
     */
    setLockedGridHeight(gridRef.current.offsetHeight);
    setLockedSectionHeight(sectionRef.current.offsetHeight);
  }, [isRow, favTotalPages, favPage, lockedGridHeight]);

  /*
   * FLIP: when items are removed/added and cards shift grid positions, animate
   * them from their previous positions to their new ones. Also animates the
   * section height so the background gradient shrinks smoothly (e.g. 2 rows → 1 row).
   */
  const cardPositions = useRef<Map<string, DOMRect>>(new Map());
  const prevFavPageForFlipRef = useRef(favPage);
  const prevFavColumnsForFlipRef = useRef(favColumns);
  const prevSectionHeightRef = useRef<number>(0);
  // Guards the mount height animation from being cancelled by FLIP while it's in progress.
  const isMountAnimatingRef = useRef(false);

  useLayoutEffect(() => {
    if (!gridRef.current || isLeaving) return;

    /*
     * Clear any inline styles the mount-enter animation set on the wrapper
     * only after the mount animation has completed; clearing mid-animation
     * would cause the wrapper to jump to its natural height instantly.
     */
    if (sectionWrapperRef.current && !isMountAnimatingRef.current) {
      const w = sectionWrapperRef.current;
      w.style.height = '';
      w.style.transition = '';
    }

    /* In a row, paging only scrolls it, and page-absolute rects ignore the
     * row's own scroll offset, so its cards are never FLIPped. */
    const pageChanged = isRow || prevFavPageForFlipRef.current !== favPage;
    const columnsChanged = prevFavColumnsForFlipRef.current !== favColumns;
    prevFavPageForFlipRef.current = favPage;
    prevFavColumnsForFlipRef.current = favColumns;

    const cards =
      gridRef.current.querySelectorAll<HTMLElement>('[data-card-id]');
    const nextPositions = new Map<string, DOMRect>();
    cards.forEach((card) => {
      const { cardId } = card.dataset;
      if (cardId) nextPositions.set(cardId, getLayoutRect(card));
    });

    if (!pageChanged && !columnsChanged) {
      const section = sectionRef.current;
      const prevHeight = prevSectionHeightRef.current;

      /*
       * Measure the natural target height BEFORE any DOM mutations so that
       * offsetHeight reflects the settled layout, not a mid-animation value.
       * If a height transition is already in progress, temporarily clear the
       * inline height so the browser computes the true natural height, then
       * restore it so the ongoing transition is unaffected.
       */
      let targetHeight = 0;
      if (section) {
        const savedH = section.style.height;
        if (savedH) section.style.height = '';
        targetHeight = section.offsetHeight;
        if (savedH) section.style.height = savedH;
      }
      const heightChanged =
        section != null &&
        prevHeight > 0 &&
        Math.abs(targetHeight - prevHeight) > 2;

      /*
       * When growing, match flip duration to the section transition so cards
       * entering the new row stay in sync with the expanding boundary.
       */
      const flipDuration = targetHeight > prevHeight ? 280 : 220;
      const movers: HTMLElement[] = [];
      cards.forEach((card) => {
        const id = card.dataset.cardId;
        if (!id) return;
        const prev = cardPositions.current.get(id);
        const next = nextPositions.get(id);
        if (!prev || !next) return;

        const dx = prev.left - next.left;
        const dy = prev.top - next.top;

        /*
         * When the row count does not change, only FLIP cards that shift
         * horizontally within the same row — not cards crossing rows (those
         * only happen when height changes) and not stationary cards.
         * This avoids the jarring full-section slide on same-row adds/removes
         * while still smoothly repositioning cards displaced within a row.
         */
        if (!heightChanged && Math.abs(dy) > 0.5) return;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

        card.style.transition = 'none';
        card.style.transform = `translate(${dx}px, ${dy}px)`;
        movers.push(card);
      });

      if (heightChanged && section) {
        section.style.height = `${prevHeight}px`;
        section.style.overflow = 'clip';
      }

      // Single forced reflow commits all pending writes before transitions start.
      if (movers.length > 0 || heightChanged) {
        void gridRef.current.offsetHeight;
      }

      movers.forEach((card) => {
        card.style.transition = `transform ${flipDuration}ms cubic-bezier(0, 0, 0.2, 1)`;
        card.style.transform = '';
        card.addEventListener(
          'transitionend',
          () => {
            card.style.transition = '';
          },
          { once: true },
        );
      });

      if (heightChanged && section) {
        section.style.transition = 'height 280ms cubic-bezier(0, 0, 0.2, 1)';
        section.style.height = `${targetHeight}px`;

        /*
         * Use a named handler so we can remove it precisely — `once: true` is
         * unsafe here because child transitionend events bubble and would fire
         * the cleanup before the section's own height transition ends.
         */
        const handleEnd = (e: TransitionEvent) => {
          if (e.target !== section || e.propertyName !== 'height') return;
          section.style.height = '';
          section.style.overflow = '';
          section.style.transition = '';
          section.removeEventListener('transitionend', handleEnd);
        };
        section.addEventListener('transitionend', handleEnd);
      }
    }

    cardPositions.current = nextPositions;
    if (sectionRef.current) {
      const el = sectionRef.current;
      /*
       * offsetHeight returns the CSS-animated start value (not the target) at t=0 of a
       * height transition, so read the inline style.height instead when it is set — that
       * value IS the targetHeight we just applied.
       */
      const inlineH = el.style.height ? parseFloat(el.style.height) : NaN;
      prevSectionHeightRef.current = Number.isNaN(inlineH)
        ? el.offsetHeight
        : inlineH;
    }
  }, [favSlice, favPage, favColumns, isRow, isLeaving]);

  /*
   * On mount: grow from 0 → natural height so the Browse section slides down smoothly.
   * No overflow:clip — section starts at opacity:0 (sectionEnter), so clipping is unnecessary
   * and would cause the translateY(-8px) shift to clip at the wrapper's top edge.
   */
  useLayoutEffect(() => {
    const el = sectionWrapperRef.current;
    if (!el) return;
    const naturalH = el.offsetHeight;
    if (naturalH === 0) return;

    isMountAnimatingRef.current = true;
    el.style.height = '0px';
    void el.offsetHeight;
    el.style.transition = 'height 300ms cubic-bezier(0, 0, 0.2, 1)';
    el.style.height = `${naturalH}px`;

    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== 'height') return;
      clearStyles();
    };
    const clearStyles = () => {
      isMountAnimatingRef.current = false;
      // Only clear when enter completed (not if a concurrent exit already set height to 0).
      if (parseFloat(el.style.height || '0') > 0) {
        el.style.height = '';
        el.style.transition = '';
      }
      clearTimeout(fallback);
      el.removeEventListener('transitionend', onEnd);
    };
    // Fallback: clear in case transitionend is delayed (e.g. background tab).
    const fallback = setTimeout(clearStyles, 400);
    el.addEventListener('transitionend', onEnd);
    /*
     * Clear on cleanup too. StrictMode re-runs this effect mid-transition, when
     * offsetHeight reads 0 and the re-run bails out; without this the wrapper
     * kept its mount-time height for good and left a gap below the strip.
     */
    return clearStyles;
  }, []);

  /*
   * On exit: collapse to 0 in sync with sectionExit CSS animation so Browse slides up smoothly.
   * No overflow:clip — section fades out via sectionExit, so clipping is unnecessary.
   */
  useLayoutEffect(() => {
    if (!isLeaving || !sectionWrapperRef.current) return;
    const el = sectionWrapperRef.current;
    const currentH = el.offsetHeight;
    if (currentH === 0) return;
    el.style.height = `${currentH}px`;
    void el.offsetHeight;
    el.style.transition = 'height 260ms ease-in';
    el.style.height = '0px';
    // No cleanup needed — section is unmounted via onExitComplete after sectionExit fires.
  }, [isLeaving]);

  const getRowCards = useCallback(
    (): HTMLElement[] =>
      gridRef.current
        ? Array.from(
            gridRef.current.querySelectorAll<HTMLElement>('[data-card-id]'),
          )
        : [],
    [],
  );

  /*
   * The page a pager tap is smooth-scrolling the row to. Until the row gets
   * there, scroll frames still report the card it is leaving, so they must not
   * move the counter back — that flickered it and made a quick second tap
   * start from the old page.
   */
  const pagerTargetPageRef = useRef<number | null>(null);

  // Keeps the page counter on the card the user swiped to.
  const rowScrollFrameRef = useRef<number | null>(null);
  const handleRowScroll = useCallback(() => {
    if (rowScrollFrameRef.current != null) return;
    rowScrollFrameRef.current = requestAnimationFrame(() => {
      rowScrollFrameRef.current = null;
      const row = gridRef.current;
      if (!row) return;
      const page = getRowActiveIndex(row, getRowCards()) + 1;
      if (pagerTargetPageRef.current != null) {
        if (page !== pagerTargetPageRef.current) return;
        pagerTargetPageRef.current = null;
      }
      setFavPage(page);
    });
  }, [getRowCards]);

  // The scroll settled, or the user took over with a swipe.
  const handleRowScrollRelease = useCallback(() => {
    pagerTargetPageRef.current = null;
  }, []);

  useEffect(
    () => () => {
      if (rowScrollFrameRef.current != null)
        cancelAnimationFrame(rowScrollFrameRef.current);
    },
    [],
  );

  const handlePageChange = (page: number) => {
    setFavPage(page);
    if (!isRow || !gridRef.current) return;
    const card = getRowCards()[page - 1];
    if (!card) return;
    const delta = getRowScrollDelta(gridRef.current, card);
    // Already in place: no scroll event will come to release the target.
    if (Math.abs(delta) < 1) return;
    pagerTargetPageRef.current = page;
    gridRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div ref={sectionWrapperRef}>
      <section
        ref={sectionRef}
        className={mergeClasses(
          'flex shrink-0 flex-col gap-4 pt-2 pb-2',
          styles.section,
          isLeaving && styles.sectionLeaving,
        )}
        style={{ ...cssVars, minHeight: lockedSectionHeight }}
        onAnimationEnd={(e) => {
          if (e.target === sectionRef.current && isLeaving) onExitComplete?.();
        }}
      >
        <ItemHeader
          title={title}
          postfix={displayCount}
          titleClassName={mergeClasses(titleClassName, styles.titleText)}
          postfixClassName={mergeClasses(countClassName, styles.countText)}
          trailing={
            favTotalPages > 1 ? (
              <div
                className={mergeClasses(
                  'inline-flex items-center gap-[2px] rounded-full px-[6px] py-[3px]',
                  styles.pageNav,
                )}
              >
                <GhostIconButton
                  size={ElementSize.Small}
                  aria-label={prevPageAriaLabel}
                  disabled={favPage === 1}
                  onClick={() => handlePageChange(favPage - 1)}
                  className={mergeClasses('rounded-full', styles.navBtn)}
                  icon={
                    <IconChevronLeft
                      size={14}
                      aria-hidden
                      className="rtl:scale-x-[-1]"
                      stroke={DIAL_KIT_ICON_STROKE}
                    />
                  }
                />
                <span
                  className={mergeClasses(
                    'min-w-[32px] px-1 text-center select-none',
                    countClassName,
                    styles.countText,
                  )}
                >
                  {favPage} / {favTotalPages}
                </span>
                <GhostIconButton
                  size={ElementSize.Small}
                  aria-label={nextPageAriaLabel}
                  disabled={favPage === favTotalPages}
                  onClick={() => handlePageChange(favPage + 1)}
                  className={mergeClasses('rounded-full', styles.navBtn)}
                  icon={
                    <IconChevronRight
                      size={14}
                      aria-hidden
                      className="rtl:scale-x-[-1]"
                      stroke={DIAL_KIT_ICON_STROKE}
                    />
                  }
                />
              </div>
            ) : undefined
          }
        />

        <div
          ref={gridRef}
          className={mergeClasses(
            'grid content-start',
            /* Let the next card peek through the host's 16px mobile gutter.
               Compensated padding preserves alignment; the vertical mask fades
               only the shadow in that padding, avoiding a hard scroll-box edge. */
            isRow
              ? '-m-4 snap-x snap-mandatory scroll-p-4 scrollbar-none auto-cols-[328px] grid-flow-col gap-2 overflow-x-auto mask-[linear-gradient(to_bottom,transparent,black_16px,black_calc(100%-16px),transparent)] p-4 *:snap-start'
              : 'gap-5',
            styles.gridPage,
          )}
          style={{
            gridTemplateColumns: isRow
              ? undefined
              : `repeat(${favColumns}, minmax(0, 1fr))`,
            minHeight: lockedGridHeight,
          }}
          onScroll={isRow ? handleRowScroll : undefined}
          onScrollEnd={isRow ? handleRowScrollRelease : undefined}
          onPointerDown={isRow ? handleRowScrollRelease : undefined}
        >
          {favSlice.map((item) => (
            <FavoriteCard
              /* A paged grid remounts its cards per page to replay the
                 fade-in; a row keeps them, or every swipe would re-animate. */
              key={isPaged ? `${favPage}-${item.id}` : item.id}
              item={item}
              onToggle={onToggleFavorite}
              isFavoriteVisible={isFavoriteVisible}
              onClick={onItemClick}
              addToFavoritesAriaLabel={addToFavoritesAriaLabel}
              removeFromFavoritesAriaLabel={removeFromFavoritesAriaLabel}
              isSelected={item.id === selectedItemId}
              credentialsBadgeLoggedOutLabel={credentialsBadgeLoggedOutLabel}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

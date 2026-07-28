import { mergeClasses, DialGrid } from '@epam/ai-dial-ui-kit';
import type { GridApi } from 'ag-grid-community';
import {
  type CSSProperties,
  FC,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import { GridContext } from '../../models/grid-context';
import { ListViewProps } from '../../models/list-props';
import { CATALOG_COLUMNS } from './columns';
import styles from './ListView.module.scss';

/** How many rows to render in the initial load and each subsequent batch. */
const PAGE_SIZE = 50;

const findScrollParent = (el: Element | null): Element | null => {
  if (!el || el === document.body) return null;
  const { overflow, overflowY } = getComputedStyle(el);
  if (
    overflow === 'auto' ||
    overflow === 'scroll' ||
    overflowY === 'auto' ||
    overflowY === 'scroll'
  ) {
    return el;
  }
  return findScrollParent(el.parentElement);
};

/** ag-grid table view of catalog items with infinite-scroll windowing. */
export const ListView: FC<ListViewProps> = ({
  items,
  query = '',
  ariaLabel = 'Catalog',
  emptyStateTitle,
  styles: listStyles,
  onToggleFavorite,
  onItemClick,
  stickyHeaderTop,
  selectedItemId,
  credentialsBadgeLoggedOutLabel,
}) => {
  const typography = listStyles?.typography ?? {};
  const colors = listStyles?.colors;
  const cssVars = {
    '--cat-list-name-text': colors?.nameText,
    ...(stickyHeaderTop != null
      ? { '--list-header-sticky-top': `${stickyHeaderTop}px` }
      : {}),
  } as CSSProperties;

  const gridApiRef = useRef<GridApi<CatalogItem> | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(items.length, PAGE_SIZE),
  );

  // Reset window when the items array changes (search / filter / sort).
  const prevItemsRef = useRef(items);
  useEffect(() => {
    if (prevItemsRef.current !== items) {
      prevItemsRef.current = items;
      setVisibleCount(Math.min(items.length, PAGE_SIZE));
    }
  }, [items]);

  /*
   * Load the next batch when the sentinel scrolls into the visible area.
   * IntersectionObserver with a non-document root is unreliable here, so
   * a plain scroll listener on the nearest scroll ancestor is used instead.
   */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const scrollRoot = findScrollParent(sentinel.parentElement);
    if (!scrollRoot) return;

    const checkVisibility = () => {
      const rootRect = scrollRoot.getBoundingClientRect();
      const sentinelRect = sentinel.getBoundingClientRect();
      if (
        sentinelRect.top < rootRect.bottom &&
        sentinelRect.bottom > rootRect.top
      ) {
        setVisibleCount((c) => Math.min(items.length, c + PAGE_SIZE));
      }
    };

    scrollRoot.addEventListener('scroll', checkVisibility, { passive: true });
    checkVisibility();
    return () => scrollRoot.removeEventListener('scroll', checkVisibility);
  }, [items.length]);

  const windowedItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount],
  );

  /*
   * Refresh cell renderers when the search query changes so highlighting updates.
   * rowData is kept in sync via the prop; no need to call setGridOption here.
   */
  useEffect(() => {
    gridApiRef.current?.refreshCells({ force: true });
  }, [query]);

  /*
   * getRowClass is only re-evaluated on row redraw, not on refreshCells, so
   * the selected-row border/tint needs an explicit redraw when selection changes.
   */
  useEffect(() => {
    gridApiRef.current?.redrawRows();
  }, [selectedItemId]);

  useEffect(() => {
    gridApiRef.current?.setGridOption(
      'domLayout',
      items.length > 0 ? 'autoHeight' : 'normal',
    );
  }, [items]);

  return (
    <div
      style={cssVars}
      className={mergeClasses('w-full rounded-xl border', styles.listContainer)}
    >
      <div className={mergeClasses('rounded-xl', styles.gridClip)}>
        <DialGrid<CatalogItem>
          columnDefs={CATALOG_COLUMNS}
          rowData={windowedItems}
          getRowId={(r) => r.id}
          withoutHeaderBorders
          onGridApiChange={(api) => {
            gridApiRef.current = api;
          }}
          emptyStateTitle={emptyStateTitle}
          additionalGridOptions={{
            rowHeight: 60,
            defaultColDef: { filter: false, floatingFilter: false },
            context: {
              searchQuery: query,
              typography,
              onToggleFavorite,
              selectedItemId,
              credentialsBadgeLoggedOutLabel,
            } satisfies GridContext,
            onCellClicked: onItemClick
              ? (event) => {
                  const col = event.column.getColDef();
                  if (col.field === 'isStarred') return; // ignore clicks on the star column
                  if (event.data) onItemClick(event.data);
                }
              : undefined,
            rowClass: onItemClick ? 'cursor-pointer' : undefined,
            getRowClass: (params) =>
              params.data?.id === selectedItemId
                ? styles.selectedRow
                : undefined,
          }}
          ariaLabel={ariaLabel}
        />
        {visibleCount < items.length && (
          <div ref={sentinelRef} className="h-2" aria-hidden />
        )}
      </div>
    </div>
  );
};

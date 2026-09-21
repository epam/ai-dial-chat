import { PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-ui-kit';
import { Grid } from '@epam/ai-dial-ui-kit/grid';
import type { GridApi, GridOptions } from 'ag-grid-community';
import {
  type CSSProperties,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { CATALOG_CLASS } from '../../constants/public-class-names';
import type { CatalogItem } from '../../models/catalog-item';
import { GridContext } from '../../models/grid-context';
import { ListViewProps } from '../../models/list-props';
import { useRowWindow } from '../../utils/scroll-window';
import { CATALOG_COLUMNS } from './columns';
import styles from './ListView.module.scss';

/** Height of every row, in pixels. Fixed, so the window's spacers are exact. */
const ROW_HEIGHT = 60;
const EMPTY_TYPOGRAPHY = {};
const getRowId = (item: CatalogItem) => item.id;

/** ag-grid table view of catalog items, windowed to the rows in view. */
export const ListView: FC<ListViewProps> = (props) => {
  if (props.items.length === 0) {
    return (
      <div
        className={mergeClasses(
          'flex size-full flex-col items-center justify-center',
          CATALOG_CLASS.listView,
        )}
      >
        <PanelEmptyState label={props.emptyStateTitle ?? 'No results'} />
      </div>
    );
  }

  return <WindowedListView {...props} />;
};

const WindowedListView: FC<ListViewProps> = ({
  items,
  type,
  query = '',
  ariaLabel = 'Catalog',
  emptyStateTitle,
  styles: listStyles,
  onToggleFavorite,
  isFavoriteVisible,
  onItemClick,
  stickyHeaderTop,
  selectedItemId,
  credentialsBadgeLoggedOutLabel,
  isReadonly = false,
  columnVisibility,
}) => {
  const typography = listStyles?.typography ?? EMPTY_TYPOGRAPHY;
  const colors = listStyles?.colors;
  const cssVars = {
    '--cat-list-bg': colors?.background,
    '--cat-list-border': colors?.border,
    '--cat-list-header-bg': colors?.headerBackground,
    '--cat-list-row-divider': colors?.rowDivider,
    '--cat-card-star-filled': colors?.starFilled,
    '--cat-list-folder-icon': colors?.folderIcon,
    '--cat-list-row-even-bg': colors?.rowEvenBackground,
    '--cat-list-selected-border': colors?.selectedRowBorder,
    '--cat-list-selected-bg': colors?.selectedRowBackground,
    '--cat-list-selected-check': colors?.selectedRowCheckIcon,
    ...(stickyHeaderTop != null
      ? { '--list-header-sticky-top': `${stickyHeaderTop}px` }
      : {}),
  } as CSSProperties;

  const gridApiRef = useRef<GridApi<CatalogItem> | null>(null);
  const handleGridApiChange = useCallback(
    (api: GridApi<CatalogItem> | null) => {
      gridApiRef.current = api;
    },
    [],
  );
  const columnDefs = useMemo(
    () => CATALOG_COLUMNS(type, isReadonly, columnVisibility),
    [type, isReadonly, columnVisibility],
  );
  const gridOptions = useMemo<GridOptions<CatalogItem>>(
    () => ({
      domLayout: 'autoHeight',
      rowHeight: ROW_HEIGHT,
      /*
       * Moving the window changes row indexes, not the catalog order. An
       * animation would move retained rows a second time after the spacer
       * has already moved them. Draw this bounded slice without deferring
       * its cells to later animation frames or resetting the scroll position.
       */
      animateRows: false,
      suppressAnimationFrame: true,
      suppressScrollOnNewData: true,
      defaultColDef: { filter: false, floatingFilter: false },
      context: {
        searchQuery: query,
        typography,
        onToggleFavorite,
        isFavoriteVisible,
        selectedItemId,
        credentialsBadgeLoggedOutLabel,
        isReadonly,
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
        params.data?.id === selectedItemId ? styles.selectedRow : undefined,
    }),
    [
      query,
      typography,
      onToggleFavorite,
      isFavoriteVisible,
      selectedItemId,
      credentialsBadgeLoggedOutLabel,
      isReadonly,
      onItemClick,
    ],
  );

  /*
   * `domLayout: 'autoHeight'` is what lets the table scroll with the page
   * instead of inside its own box, and it switches ag-grid's own row
   * virtualisation off: every row it is given goes into the DOM, five React
   * cell renderers each. So it is only ever given the rows around the
   * viewport, with a spacer standing in for the rest of the table's height.
   */
  const { containerRef, startRow, endRow } = useRowWindow(
    items.length,
    ROW_HEIGHT,
  );

  const windowedItems = useMemo(
    () => items.slice(startRow, endRow),
    [items, startRow, endRow],
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

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'w-full rounded-xl border',
        styles.listContainer,
        CATALOG_CLASS.listView,
      )}
    >
      <div
        ref={containerRef}
        /* AG Grid can append restored columns out of visual order. Its edge
           classes keep header and cell padding aligned across tab changes. */
        className={mergeClasses(
          'rounded-xl [&_.ag-cell.ag-column-first]:ps-4 [&_.ag-cell.ag-column-last]:pe-4 [&_.ag-header-cell.ag-column-first]:ps-4 [&_.ag-header-cell.ag-column-last]:pe-4',
          styles.gridClip,
        )}
      >
        {startRow > 0 && (
          <div style={{ height: startRow * ROW_HEIGHT }} aria-hidden />
        )}
        <Grid<CatalogItem>
          columnDefs={columnDefs}
          rowData={windowedItems}
          getRowId={getRowId}
          withoutHeaderBorders
          /* Nothing here opens a row context menu, so the wrapper ag-grid
             cells would otherwise get — a dropdown plus a span around every
             one of the five renderers in every row — is pure weight. */
          wrapCustomCellRenderers={false}
          onGridApiChange={handleGridApiChange}
          emptyStateTitle={emptyStateTitle}
          additionalGridOptions={gridOptions}
          ariaLabel={ariaLabel}
        />
        {endRow < items.length && (
          <div
            style={{ height: (items.length - endRow) * ROW_HEIGHT }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
};

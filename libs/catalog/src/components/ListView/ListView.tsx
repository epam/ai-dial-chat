import { PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { Grid, mergeClasses } from '@epam/ai-dial-ui-kit';
import type { GridApi } from 'ag-grid-community';
import { type CSSProperties, FC, useEffect, useMemo, useRef } from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import { GridContext } from '../../models/grid-context';
import { ListViewProps } from '../../models/list-props';
import { useRowWindow } from '../../utils/scroll-window';
import { CATALOG_COLUMNS } from './columns';
import styles from './ListView.module.scss';

/** Height of every row, in pixels. Fixed, so the window's spacers are exact. */
const ROW_HEIGHT = 60;

/** ag-grid table view of catalog items, windowed to the rows in view. */
export const ListView: FC<ListViewProps> = ({
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
}) => {
  if (items.length === 0) {
    return (
      <div className="flex size-full flex-col items-center justify-center">
        <PanelEmptyState label={emptyStateTitle ?? 'No results'} />
      </div>
    );
  }

  const typography = listStyles?.typography ?? {};
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
      <div
        ref={containerRef}
        className={mergeClasses('rounded-xl', styles.gridClip)}
      >
        {startRow > 0 && (
          <div style={{ height: startRow * ROW_HEIGHT }} aria-hidden />
        )}
        <Grid<CatalogItem>
          columnDefs={CATALOG_COLUMNS(type, isReadonly)}
          rowData={windowedItems}
          getRowId={(r) => r.id}
          withoutHeaderBorders
          /* Nothing here opens a row context menu, so the wrapper ag-grid
             cells would otherwise get — a dropdown plus a span around every
             one of the five renderers in every row — is pure weight. */
          wrapCustomCellRenderers={false}
          onGridApiChange={(api) => {
            gridApiRef.current = api;
          }}
          emptyStateTitle={emptyStateTitle}
          additionalGridOptions={{
            rowHeight: ROW_HEIGHT,
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
              params.data?.id === selectedItemId
                ? styles.selectedRow
                : undefined,
          }}
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

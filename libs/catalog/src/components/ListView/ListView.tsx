import { PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { mergeClasses } from '@epam/ai-dial-ui-kit';
import { Grid } from '@epam/ai-dial-ui-kit/grid';
import type { GridApi, GridOptions } from 'ag-grid-community';
import {
  type CSSProperties,
  type KeyboardEvent,
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
import { CatalogSelectionMode } from '../../types/selection-mode';
import {
  toggleAllSelectedIds,
  toggleSelectedId,
} from '../../utils/list-selection';
import { useRowWindow } from '../../utils/scroll-window';
import { CATALOG_COLUMNS, SELECTION_COLUMN_ID } from './columns';
import styles from './ListView.module.scss';
import {
  ListSelectionContext,
  type ListSelectionContextValue,
} from './selection-context';

/** Height of every row, in pixels. Fixed, so the window's spacers are exact. */
const ROW_HEIGHT = 60;
const EMPTY_TYPOGRAPHY = {};
const EMPTY_SELECTION: ReadonlySet<string> = new Set();
const SELECT_ALL_ARIA_LABEL = 'Select all';
const getRowId = (item: CatalogItem) => item.id;
const getDefaultRowAriaLabel = (item: CatalogItem) => `Select ${item.name}`;

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
  selectionMode = CatalogSelectionMode.Single,
  selectedItemIds = EMPTY_SELECTION,
  onSelectionChange,
  selectRowAriaLabel = getDefaultRowAriaLabel,
  selectAllAriaLabel = SELECT_ALL_ARIA_LABEL,
}) => {
  const isMultiSelect = selectionMode === CatalogSelectionMode.Multiple;
  /* The single-row highlight and the checkboxes would mark the same row twice. */
  const highlightedItemId = isMultiSelect ? undefined : selectedItemId;
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
    () => CATALOG_COLUMNS(type, isReadonly, columnVisibility, isMultiSelect),
    [type, isReadonly, columnVisibility, isMultiSelect],
  );

  /*
   * Select-all works on every listed item, not only on the windowed rows the
   * grid holds, so the selection state is derived from `items` here.
   */
  const listedIds = useMemo(() => items.map(getRowId), [items]);
  const selectedListedCount = useMemo(
    () => listedIds.filter((id) => selectedItemIds.has(id)).length,
    [listedIds, selectedItemIds],
  );
  const toggleSelection = useCallback(
    (id: string) => onSelectionChange?.(toggleSelectedId(selectedItemIds, id)),
    [onSelectionChange, selectedItemIds],
  );
  const toggleAllSelection = useCallback(
    () => onSelectionChange?.(toggleAllSelectedIds(selectedItemIds, listedIds)),
    [onSelectionChange, selectedItemIds, listedIds],
  );
  const selectionContext = useMemo<ListSelectionContextValue | null>(
    () =>
      isMultiSelect
        ? {
            selectedIds: selectedItemIds,
            isAllSelected:
              listedIds.length > 0 && selectedListedCount === listedIds.length,
            isSomeSelected:
              selectedListedCount > 0 && selectedListedCount < listedIds.length,
            hasItems: listedIds.length > 0,
            toggle: toggleSelection,
            toggleAll: toggleAllSelection,
            getRowAriaLabel: selectRowAriaLabel,
            selectAllAriaLabel,
          }
        : null,
    [
      isMultiSelect,
      selectedItemIds,
      listedIds.length,
      selectedListedCount,
      toggleSelection,
      toggleAllSelection,
      selectRowAriaLabel,
      selectAllAriaLabel,
    ],
  );
  /* Grid callbacks read the latest toggle without rebuilding the grid options. */
  const toggleSelectionRef = useRef(toggleSelection);
  toggleSelectionRef.current = toggleSelection;

  /*
   * Space on a row cell toggles that row. Handled on the grid's wrapper from
   * the `row-id` AG Grid stamps on every row (from `getRowId`), rather than
   * through `onCellKeyDown`, which only fires for the cell AG Grid's own focus
   * service holds.
   */
  const handleSelectionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== ' ' || !(event.target instanceof Element)) return;
      // A focused checkbox already toggles on Space by itself.
      if (event.target instanceof HTMLInputElement) return;
      const rowId = event.target.closest('[row-id]')?.getAttribute('row-id');
      if (rowId == null) return;
      event.preventDefault();
      toggleSelection(rowId);
    },
    [toggleSelection],
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
        selectedItemId: highlightedItemId,
        credentialsBadgeLoggedOutLabel,
        isReadonly,
      } satisfies GridContext,
      onCellClicked:
        onItemClick || isMultiSelect
          ? (event) => {
              const col = event.column.getColDef();
              if (col.field === 'isStarred') return; // ignore clicks on the star column
              // The checkbox toggles its own row; a cell click would toggle it back.
              if (col.colId === SELECTION_COLUMN_ID) return;
              if (!event.data) return;
              if (isMultiSelect) toggleSelectionRef.current(event.data.id);
              onItemClick?.(event.data);
            }
          : undefined,
      rowClass: onItemClick || isMultiSelect ? 'cursor-pointer' : undefined,
      getRowClass: (params) =>
        params.data?.id === highlightedItemId ? styles.selectedRow : undefined,
    }),
    [
      query,
      typography,
      onToggleFavorite,
      isFavoriteVisible,
      highlightedItemId,
      credentialsBadgeLoggedOutLabel,
      isReadonly,
      onItemClick,
      isMultiSelect,
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
  }, [highlightedItemId]);

  return (
    <div
      style={cssVars}
      className={mergeClasses(
        'w-full rounded-xl border',
        styles.listContainer,
        CATALOG_CLASS.listView,
      )}
    >
      {/* Delegates Space from the grid's focusable cells; see handleSelectionKeyDown. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={containerRef}
        onKeyDown={isMultiSelect ? handleSelectionKeyDown : undefined}
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
        <ListSelectionContext.Provider value={selectionContext}>
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
        </ListSelectionContext.Provider>
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

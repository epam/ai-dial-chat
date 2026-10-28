import { mergeClasses } from '@epam/ai-dial-ui-kit';
import {
  Grid,
  GridAppearance,
  GRID_SELECTION_COLUMN_ID,
  GridSelectionMode,
} from '@epam/ai-dial-ui-kit/grid';
import type {
  BodyScrollEvent,
  CellClickedEvent,
  CellKeyDownEvent,
  ColDef,
  GridApi,
  GridOptions,
} from 'ag-grid-community';
import {
  type CSSProperties,
  FC,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { CATALOG_CLASS } from '../../constants/public-class-names';
import type { CatalogItem } from '../../models/catalog-item';
import { GridContext } from '../../models/grid-context';
import { ListViewProps } from '../../models/list-props';
import { CatalogSelectionMode } from '../../types/selection-mode';
import { mergeGridSelection } from '../../utils/list-selection';
import { CATALOG_COLUMNS } from './columns';

/** Height of every row, in pixels. */
const ROW_HEIGHT = 60;
/** Field of the Favorite column, whose star button handles its own clicks and keys. */
const FAVORITE_FIELD = 'isStarred';
/*
 * Constant, so the grid options can change (a search, a selection) without the
 * grid rebuilding its columns: a new `defaultColDef` makes ag-grid recreate
 * them. `suppressSizeToFit` keeps the kit Grid's `sizeColumnsToFit` (on ready
 * and on every size change) off the columns, which would reset each to its base
 * width and spread the rest by it, ignoring `flex`. `flex` alone keeps the
 * columns fitted to the width.
 */
const DEFAULT_COL_DEF: ColDef<CatalogItem> = {
  filter: false,
  floatingFilter: false,
  suppressSizeToFit: true,
};
/*
 * Single mode borrows ag-grid's row selection only to mark `selectedItemId`:
 * no selection column, and a click picks the item instead of selecting it.
 */
const SINGLE_ROW_SELECTION: GridOptions<CatalogItem>['rowSelection'] = {
  mode: 'singleRow',
  checkboxes: false,
  enableClickSelection: false,
};
const EMPTY_TYPOGRAPHY = {};
const EMPTY_SELECTION: ReadonlySet<string> = new Set();
const SELECT_ALL_ARIA_LABEL = 'Select all';
/* Selection source reported for a row click; any source but `api` reaches `onSelectionChange`. */
const ROW_CLICK_SOURCE = 'rowClicked';
const getRowId = (item: CatalogItem) => item.id;
const getDefaultRowAriaLabel = (item: CatalogItem) => `Select ${item.name}`;
const isFavoriteColumn = (event: { colDef: ColDef<CatalogItem> }) =>
  event.colDef.field === FAVORITE_FIELD;

/** ui-kit `Grid` table view of catalog items. */
export const ListView: FC<ListViewProps> = ({
  ref,
  onRowsScroll,
  items,
  type,
  query = '',
  ariaLabel = 'Catalog',
  emptyStateTitle = 'No results',
  emptyStateDescription,
  styles: listStyles,
  onToggleFavorite,
  isFavoriteVisible,
  onItemClick,
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
    '--cat-card-star-filled': colors?.starFilled,
    '--cat-list-folder-icon': colors?.folderIcon,
    '--cat-list-selected-check': colors?.selectedRowCheckIcon,
  } as CSSProperties;

  const gridApiRef = useRef<GridApi<CatalogItem> | null>(null);
  /* Read through a ref so a new callback identity does not resubscribe. */
  const onRowsScrollRef = useRef(onRowsScroll);
  onRowsScrollRef.current = onRowsScroll;
  const handleBodyScroll = useCallback(
    (event: BodyScrollEvent<CatalogItem>) => {
      if (event.direction !== 'vertical') return;
      onRowsScrollRef.current?.(event.top);
    },
    [],
  );
  const unsubscribeBodyScroll = useCallback(() => {
    const api = gridApiRef.current;
    if (api != null && !api.isDestroyed()) {
      api.removeEventListener('bodyScroll', handleBodyScroll);
    }
  }, [handleBodyScroll]);
  const handleGridApiChange = useCallback(
    (api: GridApi<CatalogItem>) => {
      unsubscribeBodyScroll();
      gridApiRef.current = api;
      api.addEventListener('bodyScroll', handleBodyScroll);
    },
    [unsubscribeBodyScroll, handleBodyScroll],
  );
  useEffect(() => unsubscribeBodyScroll, [unsubscribeBodyScroll]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: () => {
        const api = gridApiRef.current;
        if (
          api == null ||
          api.isDestroyed() ||
          api.getDisplayedRowCount() === 0
        ) {
          return;
        }
        api.ensureIndexVisible(0, 'top');
      },
    }),
    [],
  );
  const columnDefs = useMemo(
    () => CATALOG_COLUMNS(type, isReadonly, columnVisibility),
    [type, isReadonly, columnVisibility],
  );

  const listedIds = useMemo(() => items.map(getRowId), [items]);
  const handleSelectionChange = useCallback(
    (gridIds: Set<string>) =>
      onSelectionChange?.(
        mergeGridSelection(selectedItemIds, gridIds, listedIds),
      ),
    [onSelectionChange, selectedItemIds, listedIds],
  );
  const highlightedRowIds = useMemo(
    () => new Set(highlightedItemId == null ? [] : [highlightedItemId]),
    [highlightedItemId],
  );

  const gridOptions = useMemo<GridOptions<CatalogItem>>(
    () => ({
      rowHeight: ROW_HEIGHT,
      /* The kit Grid turns cell focus off; the keyboard reaches rows through it. */
      suppressCellFocus: false,
      defaultColDef: DEFAULT_COL_DEF,
      rowSelection: isMultiSelect ? undefined : SINGLE_ROW_SELECTION,
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
          ? (event: CellClickedEvent<CatalogItem>) => {
              if (isFavoriteColumn(event) || !event.data) return;
              // The kit's checkbox toggles its own row; a cell click would toggle it back.
              if (event.colDef.colId === GRID_SELECTION_COLUMN_ID) return;
              /* ag-grid hears the native click, so the star's React
                 `stopPropagation` cannot keep the row from toggling; the
                 toggle is made here, where the star column is skipped. */
              if (isMultiSelect) {
                event.node.setSelected(
                  !event.node.isSelected(),
                  false,
                  ROW_CLICK_SOURCE,
                );
              }
              onItemClick?.(event.data);
            }
          : undefined,
      onCellKeyDown:
        onItemClick && !isMultiSelect
          ? (event: CellKeyDownEvent<CatalogItem>) => {
              const key = (event.event as KeyboardEvent | null)?.key;
              if (key !== 'Enter' && key !== ' ') return;
              if (isFavoriteColumn(event) || !event.data) return;
              event.event?.preventDefault();
              onItemClick(event.data);
            }
          : undefined,
      rowClass: onItemClick || isMultiSelect ? 'cursor-pointer' : undefined,
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
   * Cell renderers read the search query and the highlighted id from the grid
   * context, which ag-grid does not push to rendered cells on its own.
   */
  useEffect(() => {
    gridApiRef.current?.refreshCells({ force: true });
  }, [query, highlightedItemId]);

  return (
    <div
      style={cssVars}
      className={mergeClasses('size-full', CATALOG_CLASS.listView)}
    >
      {/* The kit's "Chat table": borderless 12px card with the MD shadow, inset row dividers. */}
      <Grid<CatalogItem>
        appearance={GridAppearance.Chat}
        columnDefs={columnDefs}
        rowData={items}
        getRowId={getRowId}
        withoutHeaderBorders
        /* Nothing here opens a row context menu, so the wrapper the kit would
           put around every custom cell renderer is pure weight. */
        wrapCustomCellRenderers={false}
        onGridApiChange={handleGridApiChange}
        emptyStateTitle={emptyStateTitle}
        emptyStateDescription={emptyStateDescription ?? ''}
        additionalGridOptions={gridOptions}
        ariaLabel={ariaLabel}
        {...(isMultiSelect
          ? {
              selectionMode: GridSelectionMode.MULTIPLE,
              selectedRowIds: selectedItemIds as Set<string>,
              onSelectionChange: handleSelectionChange,
              selectRowLabel: selectRowAriaLabel,
              selectAllLabel: selectAllAriaLabel,
            }
          : { selectedRowIds: highlightedRowIds })}
      />
    </div>
  );
};

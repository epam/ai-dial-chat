import { DialGrid } from '@epam/ai-dial-ui-kit';
import type { GridApi } from 'ag-grid-community';
import { type CSSProperties, FC, useEffect, useRef } from 'react';
import type { CatalogItem } from '../../models/catalog-item';
import { GridContext } from '../../models/grid-context';
import { CatalogListViewProps } from '../../models/list-props';
import { CATALOG_COLUMNS } from './columns';

/**
 * ag-grid table view of catalog items.
 * Passes searchQuery via grid context so cell renderers can highlight without
 * relying on a module-level variable.
 */
export const CatalogListView: FC<CatalogListViewProps> = ({
  items,
  query = '',
  ariaLabel = 'Catalog',
  emptyStateTitle,
  emptyStateDescription,
  styles: listStyles,
}) => {
  const typography = listStyles?.typography ?? {};
  const colors = listStyles?.colors;
  const cssVars = {
    '--cat-list-name-text': colors?.nameText,
    '--cat-list-secondary-text': colors?.secondaryText,
  } as CSSProperties;

  const gridApiRef = useRef<GridApi<CatalogItem> | null>(null);

  useEffect(() => {
    if (!gridApiRef.current) return;
    gridApiRef.current.setGridOption('rowData', items);
    gridApiRef.current.refreshCells({ force: true });
  }, [items, query]);

  return (
    <div style={cssVars as CSSProperties} className="size-full px-4">
      <DialGrid<CatalogItem>
        columnDefs={CATALOG_COLUMNS()}
        rowData={items}
        getRowId={(r) => r.id}
        alternateOddRowColors
        onGridApiChange={(api) => {
          gridApiRef.current = api;
        }}
        emptyStateTitle={emptyStateTitle}
        emptyStateDescription={emptyStateDescription}
        additionalGridOptions={{
          rowHeight: 90,
          defaultColDef: { filter: false, floatingFilter: false },
          context: { searchQuery: query, typography } satisfies GridContext,
        }}
        ariaLabel={ariaLabel}
      />
    </div>
  );
};

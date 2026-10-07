import { Checkbox } from '@epam/ai-dial-ui-kit';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { useListSelection } from '../selection-context';

/** ag-grid cell renderer for a row's checkbox in the multi-select column. */
export const SelectionCellRenderer: FC<ICellRendererParams<CatalogItem>> = ({
  data,
}) => {
  const { selectedIds, toggle, getRowAriaLabel } = useListSelection();

  if (!data) return null;

  return (
    <div className="flex size-full items-center">
      <Checkbox
        isSelected={selectedIds.has(data.id)}
        aria-label={getRowAriaLabel(data)}
        onChange={() => toggle(data.id)}
      />
    </div>
  );
};

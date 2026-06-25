import type { ICellRendererParams } from 'ag-grid-community';
import { MouseEvent, forwardRef, useImperativeHandle, useState } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { StarToggleButton } from '../../StarToggleButton/StarToggleButton';

// ag-grid calls refresh() on cell renderers instead of re-mounting when rowData
// updates. Returning true tells ag-grid "handled" and preserves local state,
// preventing the optimistic toggle from being overwritten by a stale data.isStarred.
export const StarCellRenderer = forwardRef<
  unknown,
  ICellRendererParams<CatalogItem, unknown, GridContext>
>(({ data, context }, ref) => {
  const [isStarred, setIsStarred] = useState(data?.isStarred ?? false);

  useImperativeHandle(ref, () => ({
    refresh: () => true,
  }));

  if (!data) return null;

  const handleToggle = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const next = !isStarred;
    setIsStarred(next);
    context?.onToggleFavorite?.(data.id, next);
  };

  return (
    <div className="flex h-full items-center justify-center pe-4">
      <StarToggleButton isStarred={isStarred} onClick={handleToggle} />
    </div>
  );
});

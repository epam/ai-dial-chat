import type { ICellRendererParams } from 'ag-grid-community';
import { FC, MouseEvent, useEffect, useState } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { StarToggleButton } from '../../StarToggleButton/StarToggleButton';
import styles from '../ListView.module.scss';

/** ag-grid cell renderer for the star/favorite toggle column. */
export const StarCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data, context }) => {
  const [isStarred, setIsStarred] = useState(data?.isStarred ?? false);

  /*
   * Resyncs local optimistic state when the caller's `favoriteIds` reverts
   * after a failed toggle request — without this, the star stays stuck on
   * whatever the user last clicked (issue #7924). Depends on the primitive
   * `id`/`isStarred` values, not the `data` object reference, so an
   * ag-grid-issued row refresh that recreates `data` with the same values
   * does not retrigger the resync.
   */
  useEffect(() => {
    setIsStarred(data?.isStarred ?? false);
  }, [data?.id, data?.isStarred]);

  if (!data) return null;

  const handleToggle = (e: MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const next = !isStarred;
    setIsStarred(next);
    context?.onToggleFavorite?.(data.id, next);
  };

  return (
    <div className="flex h-full items-center justify-end pe-4">
      <StarToggleButton
        isStarred={isStarred}
        onClick={handleToggle}
        className={!isStarred ? styles.starToggleOff : undefined}
      />
    </div>
  );
};

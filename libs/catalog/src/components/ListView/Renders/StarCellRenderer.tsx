import type { ICellRendererParams } from 'ag-grid-community';
import { FC, MouseEvent, useState } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { StarToggleButton } from '../../StarToggleButton/StarToggleButton';
import styles from '../ListView.module.scss';

/** ag-grid cell renderer for the star/favorite toggle column. */
export const StarCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data, context }) => {
  const [isStarred, setIsStarred] = useState(data?.isStarred ?? false);

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

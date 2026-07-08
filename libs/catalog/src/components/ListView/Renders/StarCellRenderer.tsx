import type { ICellRendererParams } from 'ag-grid-community';
import {
  FC,
  MouseEvent,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { StarToggleButton } from '../../StarToggleButton/StarToggleButton';

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
    <div className="flex h-full items-center justify-center pe-4">
      <StarToggleButton isStarred={isStarred} onClick={handleToggle} />
    </div>
  );
};

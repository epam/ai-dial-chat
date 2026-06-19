import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog';
import { GridContext } from '../../../models/GridContext';
import { EntityTypeBadge } from '../../EntityTypeBadge/EntityTypeBadge';

export const EntityTypeCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data }) => {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <EntityTypeBadge type={data.type} />
    </div>
  );
};

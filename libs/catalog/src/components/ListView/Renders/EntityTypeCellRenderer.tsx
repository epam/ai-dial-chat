import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { EntityTypeLabel } from '../../EntityTypeLabel/EntityTypeLabel';

export const EntityTypeCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data }) => {
  if (!data) return null;

  return (
    <div className="flex h-full items-center">
      <EntityTypeLabel type={data.type} />
    </div>
  );
};

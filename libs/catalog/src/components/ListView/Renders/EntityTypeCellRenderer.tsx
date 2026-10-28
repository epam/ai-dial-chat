import { CatalogEntityType, EntityTypeLabel } from '@epam/ai-dial-chat-shared';
import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';

/** ag-grid cell renderer for the entity-type column. */
export const EntityTypeCellRenderer: FC<
  ICellRendererParams<CatalogItem, CatalogEntityType, GridContext>
> = ({ data, value }) => {
  if (!data) return null;

  return (
    <div className="flex h-full items-center">
      <EntityTypeLabel type={value ?? data.type} />
    </div>
  );
};

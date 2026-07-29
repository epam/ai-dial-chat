import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import { FolderPath } from '../../FolderPath/FolderPath';

/** ag-grid cell renderer for the folder-path column. */
export const FolderCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data, context }) => {
  if (!data || data.folder.length === 0) return null;

  return (
    <FolderPath
      segments={data.folder}
      labelClassName={context?.typography?.folderClassName}
      leafClassName={context?.typography?.folderLastSegmentClassName}
    />
  );
};

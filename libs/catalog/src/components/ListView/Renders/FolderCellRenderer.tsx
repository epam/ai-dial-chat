import type { ICellRendererParams } from 'ag-grid-community';
import { FC } from 'react';
import type { CatalogItem } from '../../../models/catalog-item';
import { GridContext } from '../../../models/grid-context';
import styles from '../ListView.module.scss';

export const FolderCellRenderer: FC<
  ICellRendererParams<CatalogItem, unknown, GridContext>
> = ({ data, context }) => {
  const folderClassName =
    context?.typography?.folderClassName ?? 'dial-small-text';

  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <span className={[folderClassName, styles.secondaryText].join(' ')}>
        {data.folder.join(' / ')}
      </span>
    </div>
  );
};

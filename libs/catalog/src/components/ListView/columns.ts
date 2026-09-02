import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { ColDef } from 'ag-grid-community';
import { CatalogItem } from '../../models/catalog-item';
import styles from './ListView.module.scss';
import { EntityTypeCellRenderer } from './Renders/EntityTypeCellRenderer';
import { FolderCellRenderer } from './Renders/FolderCellRenderer';
import { NameCellRenderer } from './Renders/NameCellRenderer';
import { StarCellRenderer } from './Renders/StarCellRenderer';
import { TagsCellRenderer } from './Renders/TagsCellRenderer';

/** Column definitions for the catalog ag-grid list view. A stable module-level constant so ag-grid never sees a new array/closures on each render. */
export const CATALOG_COLUMNS = (
  type: CatalogEntityType,
  isReadonly = false,
  items: CatalogItem[] = [],
  isFavoriteVisible?: (item: CatalogItem) => boolean,
): ColDef<CatalogItem>[] => {
  return [
    {
      headerName: 'Name',
      flex: 1,
      minWidth: 220,
      field: 'name',
      filter: false,
      cellRenderer: NameCellRenderer,
      valueGetter: (p) => p.data?.name,
    },
    {
      headerName: 'Type',
      width: 110,
      minWidth: 110,
      field: 'type',
      filter: false,
      sortable: false,
      cellRenderer: EntityTypeCellRenderer,
      valueGetter: (p) => p.data?.type,
    },
    {
      headerName: 'Folder',
      field: 'folder',
      width: 170,
      minWidth: 170,
      filter: false,
      hide: type === CatalogEntityType.Model,
      cellRenderer: FolderCellRenderer,
      valueGetter: (p) => p.data?.folder,
    },
    {
      headerName: 'Tags',
      field: 'topics',
      width: 230,
      minWidth: 230,
      filter: false,
      sortable: false,
      cellRenderer: TagsCellRenderer,
      valueGetter: (p) => p.data?.topics,
    },
    {
      headerName: 'Favorite',
      field: 'isStarred',
      width: 72,
      minWidth: 72,
      filter: false,
      sortable: false,
      resizable: false,
      /**
       * Also hidden when nothing in the active tab is favoritable at all
       * (e.g. a pure-Models tab), so the header doesn't sit above an empty
       * column. `.some` rather than `.every` keeps the column when only some
       * rows lack a star.
       */
      hide:
        isReadonly ||
        (items.length > 0 &&
          !items.some((item) => isFavoriteVisible?.(item) ?? true)),
      headerClass: styles.favHeader,
      cellRenderer: StarCellRenderer,
    },
  ];
};

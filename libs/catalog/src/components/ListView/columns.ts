import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { ColDef } from 'ag-grid-community';
import { CatalogItem } from '../../models/catalog-item';
import styles from './ListView.module.scss';
import { EntityTypeCellRenderer } from './Renders/EntityTypeCellRenderer';
import { FolderCellRenderer } from './Renders/FolderCellRenderer';
import { NameCellRenderer } from './Renders/NameCellRenderer';
import { StarCellRenderer } from './Renders/StarCellRenderer';
import { TagsCellRenderer } from './Renders/TagsCellRenderer';

/**
 * Column definitions for the catalog ag-grid list view. A stable module-level constant so ag-grid never sees a new array/closures on each render.
 *
 * Name, Folder and Tags all flex, so spare width is shared instead of going to
 * Name alone: entity names are short, and letting Name absorb every free pixel
 * left Folder and Tags permanently at their floor, where paths collapsed into
 * unreadable stubs and tags were clipped mid-word. Name keeps twice the share
 * because it carries the icon, the name and the version.
 */
export const CATALOG_COLUMNS = (
  type: CatalogEntityType,
  isReadonly = false,
): ColDef<CatalogItem>[] => {
  return [
    {
      headerName: 'Name',
      flex: 2,
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
      flex: 1,
      minWidth: 170,
      filter: false,
      hide: type === CatalogEntityType.Model,
      cellRenderer: FolderCellRenderer,
      valueGetter: (p) => p.data?.folder,
    },
    {
      headerName: 'Tags',
      field: 'topics',
      flex: 1,
      minWidth: 230,
      filter: false,
      sortable: false,
      cellRenderer: TagsCellRenderer,
      valueGetter: (p) => p.data?.topics,
    },
    {
      headerName: 'Favorite',
      field: 'isStarred',
      width: 88,
      minWidth: 88,
      filter: false,
      sortable: false,
      resizable: false,
      hide: isReadonly,
      headerClass: styles.favHeader,
      cellRenderer: StarCellRenderer,
    },
  ];
};

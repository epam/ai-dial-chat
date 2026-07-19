import type { ColDef } from 'ag-grid-community';
import { CatalogItem } from '../../models/catalog-item';
import styles from './ListView.module.scss';
import { EntityTypeCellRenderer } from './Renders/EntityTypeCellRenderer';
import { FolderCellRenderer } from './Renders/FolderCellRenderer';
import { NameCellRenderer } from './Renders/NameCellRenderer';
import { StarCellRenderer } from './Renders/StarCellRenderer';
import { TagsCellRenderer } from './Renders/TagsCellRenderer';

/**
 * Column definitions for the catalog ag-grid list view. A stable
 * module-level constant so ag-grid never sees a new array/closures on each
 * render. Only Name flexes — every other column is a fixed pixel width so
 * the row stays a predictable, dense height regardless of content (per the
 * list view's density requirement: no column should be able to force
 * wrapping).
 */
export const CATALOG_COLUMNS: ColDef<CatalogItem>[] = [
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
    filter: false,
    cellRenderer: FolderCellRenderer,
    valueGetter: (p) => p.data?.folder,
  },
  {
    headerName: 'Tags',
    field: 'topics',
    width: 230,
    filter: false,
    sortable: false,
    cellRenderer: TagsCellRenderer,
    valueGetter: (p) => p.data?.topics,
  },
  {
    headerName: 'Favorite',
    field: 'isStarred',
    width: 72,
    filter: false,
    sortable: false,
    resizable: false,
    headerClass: styles.favHeader,
    cellRenderer: StarCellRenderer,
  },
];

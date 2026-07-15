import type { ColDef } from 'ag-grid-community';
import { CatalogItem } from '../../models/catalog-item';
import { EntityTypeCellRenderer } from './Renders/EntityTypeCellRenderer';
import { FolderCellRenderer } from './Renders/FolderCellRenderer';
import { NameCellRenderer } from './Renders/NameCellRenderer';
import { StarCellRenderer } from './Renders/StarCellRenderer';
import { TagsCellRenderer } from './Renders/TagsCellRenderer';

/** Column definitions for the catalog ag-grid list view. A stable module-level constant so ag-grid never sees a new array/closures on each render. */
export const CATALOG_COLUMNS: ColDef<CatalogItem>[] = [
  {
    headerName: 'Name',
    flex: 4,
    field: 'name',
    filter: false,
    cellRenderer: NameCellRenderer,
    valueGetter: (p) => p.data?.name,
  },
  {
    headerName: 'Type',
    flex: 2,
    field: 'type',
    filter: false,
    sortable: false,
    cellRenderer: EntityTypeCellRenderer,
    valueGetter: (p) => p.data?.type,
  },
  {
    headerName: 'Folder',
    field: 'folder',
    flex: 3,
    filter: false,
    cellRenderer: FolderCellRenderer,
    valueGetter: (p) => p.data?.folder,
  },
  {
    headerName: 'Tags',
    field: 'topics',
    flex: 2,
    filter: false,
    sortable: false,
    cellRenderer: TagsCellRenderer,
    valueGetter: (p) => p.data?.topics,
  },
  {
    headerName: '',
    field: 'isStarred',
    width: 72,
    flex: undefined,
    filter: false,
    sortable: false,
    resizable: false,
    cellRenderer: StarCellRenderer,
  },
];

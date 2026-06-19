import type { ColDef } from 'ag-grid-community';
import { CatalogItem } from '../../models/CatalogItem';
import { EntityTypeCellRenderer } from './Renders/EntityTypeCellRenderer';
import { FolderCellRenderer } from './Renders/FolderCellRenderer';
import { NameCellRenderer } from './Renders/NameCellRenderer';
import { StarCellRenderer } from './Renders/StarCellRenderer';
import { TagsCellRenderer } from './Renders/TagsCellRenderer';

export const CATALOG_COLUMNS = (): ColDef<CatalogItem>[] => [
  {
    headerName: 'Name',
    flex: 4,
    filter: false,
    cellRenderer: NameCellRenderer,
    valueGetter: (p) => p.data?.name,
  },
  {
    headerName: 'Type',
    flex: 2,
    filter: false,
    sortable: false,
    cellRenderer: EntityTypeCellRenderer,
    valueGetter: (p) => p.data?.type,
  },
  {
    headerName: 'Folder',
    flex: 3,
    filter: false,
    cellRenderer: FolderCellRenderer,
    valueGetter: (p) => p.data?.folder,
  },
  {
    headerName: 'Tags',
    flex: 2,
    filter: false,
    sortable: false,
    cellRenderer: TagsCellRenderer,
  },
  {
    headerName: '',
    width: 72,
    flex: undefined,
    filter: false,
    sortable: false,
    resizable: false,
    cellRenderer: StarCellRenderer,
  },
];

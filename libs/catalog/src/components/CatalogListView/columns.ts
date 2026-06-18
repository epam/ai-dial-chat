import type { ColDef } from 'ag-grid-community';
import { CatalogItem } from '../../models/CatalogItem';
import { FolderCellRenderer } from './Renders/FolderCellRenderer';
import { NameCellRenderer } from './Renders/NameCellRenderer';
import { TagsCellRenderer } from './Renders/TagsCellRenderer';

export const CATALOG_COLUMNS = (): ColDef<CatalogItem>[] => [
  {
    headerName: 'Name',
    flex: 5,
    filter: false,
    cellRenderer: NameCellRenderer,
    valueGetter: (p) => p.data?.name,
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
];

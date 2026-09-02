import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { ColDef } from 'ag-grid-community';
import { CatalogItem } from '../../models/catalog-item';
import styles from './ListView.module.scss';
import { EntityTypeCellRenderer } from './Renders/EntityTypeCellRenderer';
import { FolderCellRenderer } from './Renders/FolderCellRenderer';
import { NameCellRenderer } from './Renders/NameCellRenderer';
import { StarCellRenderer } from './Renders/StarCellRenderer';
import { TagsCellRenderer } from './Renders/TagsCellRenderer';

/** The optional built-in `ListView` columns a host can independently show or hide per entity type. */
export type ListViewColumnKey = 'folder' | 'tags' | 'favorite';

/**
 * Per-column rule resolving whether an optional `ListView` column renders for
 * the active tab, given its entity `type`. Overrides the column's built-in
 * default rule; omitted keys keep their default.
 */
export type ListViewColumnVisibility = Partial<
  Record<ListViewColumnKey, (type: CatalogEntityType) => boolean>
>;

/**
 * Built-in default visibility rules, one per optional column. Independent of
 * `isFavoriteVisible` (which only gates the star on individual rows) — a
 * host that wants the "Favorite" column itself hidden for a tab (e.g.
 * Models) does so explicitly via `columnVisibility.favorite`, not by an
 * automatic aggregate over `isFavoriteVisible`.
 */
const defaultColumnVisibility: Required<ListViewColumnVisibility> = {
  folder: (type) => type !== CatalogEntityType.Model,
  tags: () => true,
  favorite: () => true,
};

/**
 * Resolves whether each optional `ListView` column renders for the active
 * tab, applying `columnVisibility` overrides on top of the built-in
 * defaults. Used by `CATALOG_COLUMNS` to compute each column's `ColDef.hide`.
 */
export const resolveColumnVisibility = (
  type: CatalogEntityType,
  columnVisibility?: ListViewColumnVisibility,
): Record<ListViewColumnKey, boolean> => {
  const keys: ListViewColumnKey[] = ['folder', 'tags', 'favorite'];
  return Object.fromEntries(
    keys.map((key) => [
      key,
      (columnVisibility?.[key] ?? defaultColumnVisibility[key])(type),
    ]),
  ) as Record<ListViewColumnKey, boolean>;
};

/** Column definitions for the catalog ag-grid list view. A stable module-level constant so ag-grid never sees a new array/closures on each render. */
export const CATALOG_COLUMNS = (
  type: CatalogEntityType,
  isReadonly = false,
  columnVisibility?: ListViewColumnVisibility,
): ColDef<CatalogItem>[] => {
  const visibility = resolveColumnVisibility(type, columnVisibility);

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
      hide: !visibility.folder,
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
      hide: !visibility.tags,
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
      hide: isReadonly || !visibility.favorite,
      headerClass: styles.favHeader,
      cellRenderer: StarCellRenderer,
    },
  ];
};

import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { ColDef } from 'ag-grid-community';
import { CatalogItem } from '../../models/catalog-item';
import styles from './ListView.module.scss';
import { EntityTypeCellRenderer } from './Renders/EntityTypeCellRenderer';
import { FolderCellRenderer } from './Renders/FolderCellRenderer';
import { NameCellRenderer } from './Renders/NameCellRenderer';
import { SelectionCellRenderer } from './Renders/SelectionCellRenderer';
import { SelectionHeader } from './Renders/SelectionHeader';
import { StarCellRenderer } from './Renders/StarCellRenderer';
import { TagsCellRenderer } from './Renders/TagsCellRenderer';

/** Column id of the multi-select checkbox column. */
export const SELECTION_COLUMN_ID = 'selection';

/** Width of the multi-select checkbox column, in pixels. */
const SELECTION_COLUMN_WIDTH = 52;

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
const resolveColumnVisibility = (
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

/**
 * Builds column definitions for the catalog list. The caller memoizes them
 * by type and visibility so scrolling does not reconfigure the grid.
 *
 * Name, Folder and Tags all flex, so spare width is shared instead of going to
 * Name alone: entity names are short, and letting Name absorb every free pixel
 * left Folder and Tags permanently at their floor, where paths collapsed into
 * unreadable stubs and tags were clipped mid-word. Name keeps twice the share
 * because it carries the icon, the name and the version.
 *
 * `isMultiSelect` prepends a checkbox column whose header and cells read the
 * selection from `ListSelectionContext`, so selecting never rebuilds columns.
 */
export const CATALOG_COLUMNS = (
  type: CatalogEntityType,
  isReadonly = false,
  columnVisibility?: ListViewColumnVisibility,
  isMultiSelect = false,
): ColDef<CatalogItem>[] => {
  const visibility = resolveColumnVisibility(type, columnVisibility);
  const selectionColumns: ColDef<CatalogItem>[] = isMultiSelect
    ? [
        {
          colId: SELECTION_COLUMN_ID,
          headerName: '',
          width: SELECTION_COLUMN_WIDTH,
          minWidth: SELECTION_COLUMN_WIDTH,
          maxWidth: SELECTION_COLUMN_WIDTH,
          filter: false,
          sortable: false,
          resizable: false,
          suppressMovable: true,
          headerComponent: SelectionHeader,
          cellRenderer: SelectionCellRenderer,
        },
      ]
    : [];

  return [
    ...selectionColumns,
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
      hide: !visibility.folder,
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
      hide: !visibility.tags,
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
      hide: isReadonly || !visibility.favorite,
      headerClass: styles.favHeader,
      cellRenderer: StarCellRenderer,
    },
  ];
};

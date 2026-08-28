import {
  DialEllipsisTooltip,
  FileManagerColumnKey,
  FileManagerGridRow,
  NAME_COLUMN,
  SIZE_COLUMN,
  UPDATED_AT_COLUMN,
} from '@epam/ai-dial-ui-kit';
import { ColDef } from 'ag-grid-community';

/**
 * Column defs for `DialFileManager`.
 *
 * The UI kit builds its own defaults with hardcoded English `headerName`s and
 * recreates them whenever the visible column set changes (e.g. on tab switch),
 * which makes the headers flash back to English. Supplying `gridOptions.columnDefs`
 * with already-translated headers keeps them correct on the very first paint.
 *
 * Note: when `columnDefs` is provided, the UI kit skips its own `visibleColumns`
 * filtering, so the filtering (including the search-mode column set) is replicated here.
 * The actions column is still appended by the UI kit itself and must not be listed.
 */

export interface FileManagerGridColumnLabels {
  name: string;
  path: string;
  updatedAt: string;
  size: string;
  author: string;
  owner: string;
}

export type FileManagerGridColumnDef =
  | ColDef<FileManagerGridRow>
  | ((
      dateLocale: Intl.LocalesArgument,
      dateOptions: Intl.DateTimeFormatOptions | undefined,
      isCompactView: boolean,
    ) => ColDef<FileManagerGridRow, unknown>);

interface PathCellRendererParams {
  data: FileManagerGridRow;
  context?: {
    disabledRowIds?: Set<string>;
    hideSearchPathItemName?: boolean;
  };
}

interface BuildFileManagerColumnDefsOptions {
  labels: FileManagerGridColumnLabels;
  visibleColumns: FileManagerColumnKey[];
  isSearchMode?: boolean;
  rootItemPath?: string;
  rootItemLabel?: string;
}

// Mirrors the UI kit's search-mode column set.
const SEARCH_MODE_COLUMNS: FileManagerColumnKey[] = [
  FileManagerColumnKey.Name,
  FileManagerColumnKey.Path,
];

const createPathColumn = (
  headerName: string,
  rootItemPath?: string,
  rootItemLabel?: string,
): ColDef<FileManagerGridRow> => ({
  colId: FileManagerColumnKey.Path,
  field: 'path',
  headerName,
  flex: 1,
  minWidth: 200,
  cellRenderer: (params: PathCellRendererParams) => {
    const isDisabled =
      params.context?.disabledRowIds?.has(params.data.path) ?? false;

    let displayPath = params.data.path;

    if (params.context?.hideSearchPathItemName) {
      if (params.data.parentPath) {
        displayPath = params.data.parentPath;
      } else {
        displayPath = displayPath.replace(/\/[^/]+\/?$/, '') || '/';
      }
    }

    if (!rootItemPath || !rootItemLabel) {
      return (
        <DialEllipsisTooltip text={displayPath} hideTooltip={isDisabled} />
      );
    }

    return (
      <DialEllipsisTooltip
        text={displayPath.replace(rootItemPath, rootItemLabel)}
        hideTooltip={isDisabled}
      />
    );
  },
});

const createTextColumn = (
  colId: FileManagerColumnKey,
  field: 'author' | 'owner',
  headerName: string,
): ColDef<FileManagerGridRow> => ({
  colId,
  field,
  headerName,
  width: 200,
  suppressSizeToFit: true,
  cellRenderer: (params: { data: FileManagerGridRow }) => params.data[field],
});

export const buildFileManagerColumnDefs = ({
  labels,
  visibleColumns,
  isSearchMode,
  rootItemPath,
  rootItemLabel,
}: BuildFileManagerColumnDefsOptions): FileManagerGridColumnDef[] => {
  const columnsByKey: Partial<
    Record<FileManagerColumnKey, FileManagerGridColumnDef>
  > = {
    [FileManagerColumnKey.Name]: NAME_COLUMN(labels.name),
    [FileManagerColumnKey.Path]: createPathColumn(
      labels.path,
      rootItemPath,
      rootItemLabel,
    ),
    [FileManagerColumnKey.UpdatedAt]: UPDATED_AT_COLUMN(labels.updatedAt),
    [FileManagerColumnKey.Size]: SIZE_COLUMN(labels.size),
    [FileManagerColumnKey.Author]: createTextColumn(
      FileManagerColumnKey.Author,
      'author',
      labels.author,
    ),
    [FileManagerColumnKey.Owner]: createTextColumn(
      FileManagerColumnKey.Owner,
      'owner',
      labels.owner,
    ),
  };

  const columnKeys = isSearchMode ? SEARCH_MODE_COLUMNS : visibleColumns;

  return columnKeys.reduce<FileManagerGridColumnDef[]>((acc, key) => {
    // The actions column is appended by the UI kit itself.
    if (key === FileManagerColumnKey.Actions) {
      return acc;
    }

    const column = columnsByKey[key];
    if (column) {
      acc.push(column);
    }

    return acc;
  }, []);
};

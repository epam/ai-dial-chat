import type { CatalogFolderRootKind } from '../types/catalog-folders';

/** Text of the catalog folder navigation. Every field has an English default in `DEFAULT_CATALOG_FOLDER_LABELS`. */
export interface CatalogFolderLabels {
  /** First tree row and first breadcrumb segment. Default: 'All entities'. */
  allEntities: string;
  /** Text of the Folders button, name of the phone button and title of the phone sheet. Default: 'Folders'. */
  button: string;
  /** Accessible name of the folder tree and of its popover. Default: 'Folders'. */
  tree: string;
  /** Accessible name of the breadcrumb navigation. Default: 'Folder path'. */
  breadcrumb: string;
  /** Accessible name of the breadcrumb's collapsed-segments button. Default: 'Show hidden path segments'. */
  showHiddenSegments: string;
}

/** A folder in the catalog folder tree. */
export interface CatalogFolderNode {
  /** Stable id: the root kind and the URI-encoded path segments joined with `/`. */
  id: string;
  /** Display name: the root label or the last path segment. */
  label: string;
  /** Root the folder sits under. */
  root: CatalogFolderRootKind;
  /** Subfolders below the root, outermost first; empty for a root node. */
  path: string[];
  /** Child folders, sorted by label. */
  children: CatalogFolderNode[];
}

/** An item's place in the folder tree. */
export interface CatalogItemFolderPath {
  /** Root the item belongs to. */
  root: CatalogFolderRootKind;
  /** Subfolders below the root, outermost first. */
  path: string[];
}

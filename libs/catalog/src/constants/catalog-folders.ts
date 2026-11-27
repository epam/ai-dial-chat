import type { CatalogFolderLabels } from '../models/catalog-folders';
import {
  type CatalogFolderRoot,
  type CatalogFolderSelection,
  CatalogFolderRootKind,
} from '../types/catalog-folders';

/** Default folder roots, in display order, with English labels. */
export const DEFAULT_CATALOG_FOLDER_ROOTS: CatalogFolderRoot[] = [
  { kind: CatalogFolderRootKind.Personal, label: 'Personal' },
  { kind: CatalogFolderRootKind.Shared, label: 'Shared with me' },
  { kind: CatalogFolderRootKind.Organization, label: 'Organization' },
];

/** English defaults for the catalog folder navigation. */
export const DEFAULT_CATALOG_FOLDER_LABELS: CatalogFolderLabels = {
  allEntities: 'All entities',
  button: 'Folders',
  tree: 'Folders',
  breadcrumb: 'Folder path',
  showHiddenSegments: 'Show hidden path segments',
};

/** The All entities selection: no root and an empty path. Shared, so callers never mutate it. */
export const ALL_ENTITIES_FOLDER_SELECTION: CatalogFolderSelection = {
  path: [],
};

/** Number of applied topics from which the tag row shows "Clear all". */
export const CLEAR_ALL_TAG_THRESHOLD = 3;

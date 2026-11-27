import { DEFAULT_CATALOG_FOLDER_LABELS } from '../constants/catalog-folders';
import type {
  CatalogFolderLabels,
  CatalogFolderNode,
  CatalogItemFolderPath,
} from '../models/catalog-folders';
import type { CatalogItem } from '../models/catalog-item';
import {
  type CatalogFolderRoot,
  CatalogFolderRootKind,
  type CatalogFolderSelection,
} from '../types/catalog-folders';

const getItemRootKind = (item: CatalogItem): CatalogFolderRootKind => {
  if (item.isMyApp) return CatalogFolderRootKind.Personal;
  if (item.sharedWithMe) return CatalogFolderRootKind.Shared;
  return CatalogFolderRootKind.Organization;
};

/** Returns the root and the subfolder path of `item`; the root follows its own/shared flags. */
export const getCatalogItemFolderPath = (
  item: CatalogItem,
  roots: CatalogFolderRoot[],
): CatalogItemFolderPath => {
  const root = getItemRootKind(item);
  const rootLabel = roots.find((r) => r.kind === root)?.label;
  const folder = item.folder ?? [];
  const path =
    rootLabel != null && folder[0] === rootLabel ? folder.slice(1) : folder;
  return { root, path };
};

/** Returns the stable id of the folder at `path` under `root`. */
export const getCatalogFolderId = (
  root: CatalogFolderRootKind,
  path: string[],
): string => [root, ...path.map(encodeURIComponent)].join('/');

const insertPath = (node: CatalogFolderNode, path: string[]): void => {
  let current = node;
  path.forEach((segment, depth) => {
    let child = current.children.find((c) => c.label === segment);
    if (child == null) {
      const childPath = path.slice(0, depth + 1);
      child = {
        id: getCatalogFolderId(current.root, childPath),
        label: segment,
        root: current.root,
        path: childPath,
        children: [],
      };
      current.children.push(child);
    }
    current = child;
  });
};

const sortNodes = (nodes: CatalogFolderNode[]): void => {
  nodes.sort((a, b) => a.label.localeCompare(b.label));
  nodes.forEach((n) => sortNodes(n.children));
};

/** Returns one node per root, in the order of `roots`, with the folders of `items` nested below and sorted by label. */
export const buildCatalogFolderTree = (
  items: CatalogItem[],
  roots: CatalogFolderRoot[],
): CatalogFolderNode[] => {
  const nodes: CatalogFolderNode[] = roots.map((r) => ({
    id: getCatalogFolderId(r.kind, []),
    label: r.label,
    root: r.kind,
    path: [],
    children: [],
  }));
  items.forEach((item) => {
    const { root, path } = getCatalogItemFolderPath(item, roots);
    const node = nodes.find((n) => n.root === root);
    if (node != null) insertPath(node, path);
  });
  nodes.forEach((n) => sortNodes(n.children));
  return nodes;
};

/** Returns the items inside the selected folder or its subfolders; All entities keeps every item. */
export const filterByFolder = (
  items: CatalogItem[],
  selection: CatalogFolderSelection,
  roots: CatalogFolderRoot[],
): CatalogItem[] => {
  if (selection.root == null) return items;
  return items.filter((item) => {
    const { root, path } = getCatalogItemFolderPath(item, roots);
    return (
      root === selection.root &&
      selection.path.every((segment, i) => path[i] === segment)
    );
  });
};

/** Returns the node of `tree` the selection names, or `undefined` for All entities or a missing folder. */
export const findCatalogFolderNode = (
  selection: CatalogFolderSelection,
  tree: CatalogFolderNode[],
): CatalogFolderNode | undefined => {
  if (selection.root == null) return undefined;
  let node = tree.find((n) => n.root === selection.root);
  for (const segment of selection.path) {
    node = node?.children.find((c) => c.label === segment);
  }
  return node;
};

/** Returns whether the selection is All entities or names a folder that exists in `tree`. */
export const isFolderSelectionValid = (
  selection: CatalogFolderSelection,
  tree: CatalogFolderNode[],
): boolean =>
  selection.root == null || findCatalogFolderNode(selection, tree) != null;

/** Returns whether two folder selections name the same folder. */
export const isSameFolderSelection = (
  a: CatalogFolderSelection,
  b: CatalogFolderSelection,
): boolean =>
  a.root === b.root &&
  a.path.length === b.path.length &&
  a.path.every((segment, i) => b.path[i] === segment);

/** Returns `DEFAULT_CATALOG_FOLDER_LABELS` with the host's overrides applied field by field. */
export const resolveCatalogFolderLabels = (
  overrides?: Partial<CatalogFolderLabels>,
  allEntities?: string,
): CatalogFolderLabels => ({
  ...DEFAULT_CATALOG_FOLDER_LABELS,
  ...(allEntities ? { allEntities } : {}),
  ...overrides,
});

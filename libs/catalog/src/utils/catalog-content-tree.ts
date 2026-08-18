import type { CatalogContentTreeNode } from '../models/item-details-data';
import { CatalogContentNodeType } from '../types/catalog-content-node-type';

/** Counts file nodes across the whole tree, at any depth; folders themselves are not counted. */
export const countFileNodes = (nodes: CatalogContentTreeNode[]): number =>
  nodes.reduce((count, node) => {
    if (node.type === CatalogContentNodeType.File) return count + 1;
    return count + countFileNodes(node.items);
  }, 0);

/** Collects the `id` of every folder node in the tree, at any depth. */
export const collectAllFolderIds = (
  nodes: CatalogContentTreeNode[],
): Set<string> => {
  const ids = new Set<string>();
  const visit = (children: CatalogContentTreeNode[]) => {
    for (const node of children) {
      if (node.type === CatalogContentNodeType.Folder) {
        ids.add(node.id);
        visit(node.items);
      }
    }
  };
  visit(nodes);
  return ids;
};

/** Returns the `name` of the node carrying `id`, searching at any depth; `undefined` when absent or `id` is `undefined`. */
export const findContentNodeName = (
  nodes: CatalogContentTreeNode[],
  id: string | undefined,
): string | undefined => {
  if (id == null) return undefined;
  for (const node of nodes) {
    if (node.id === id) return node.name;
    if (node.type === CatalogContentNodeType.Folder) {
      const found = findContentNodeName(node.items, id);
      if (found != null) return found;
    }
  }
  return undefined;
};

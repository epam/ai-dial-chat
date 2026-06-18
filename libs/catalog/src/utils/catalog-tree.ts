import type { TreeNode } from '../models/CatalogItem';

/** Returns all node IDs in a tree (root + all descendants) in depth-first order. */
export const getAllNodeIds = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((n) => [n.id, ...getAllNodeIds(n.children)]);

/** Returns all descendant IDs of a node (excluding the node itself). */
export const getDescendantIds = (node: TreeNode): string[] =>
  node.children.flatMap((c) => [c.id, ...getDescendantIds(c)]);

/**
 * Returns the effective check state for a node given the set of checked IDs.
 * Leaf nodes: checked or unchecked.
 * Parent nodes: checked when self + all descendants are checked,
 *               unchecked when none are checked, indeterminate otherwise.
 */
export const getNodeCheckState = (
  node: TreeNode,
  checked: Set<string>,
): 'checked' | 'unchecked' | 'indeterminate' => {
  const descIds = getDescendantIds(node);
  if (descIds.length === 0) {
    return checked.has(node.id) ? 'checked' : 'unchecked';
  }
  const allDesc = descIds.every((id) => checked.has(id));
  const anyDesc = descIds.some((id) => checked.has(id));
  if (checked.has(node.id) && allDesc) return 'checked';
  if (!checked.has(node.id) && !anyDesc) return 'unchecked';
  return 'indeterminate';
};

/**
 * Returns a new checked set after toggling the given node.
 * Checked/indeterminate → uncheck node + all descendants.
 * Unchecked → check node + all descendants.
 */
export const applyToggle = (
  node: TreeNode,
  checked: Set<string>,
): Set<string> => {
  const next = new Set(checked);
  const all = [node.id, ...getDescendantIds(node)];
  const state = getNodeCheckState(node, checked);
  if (state === 'checked' || state === 'indeterminate') {
    all.forEach((id) => next.delete(id));
  } else {
    all.forEach((id) => next.add(id));
  }
  return next;
};

/** Recursively finds the label for a node ID in a tree, or null if not found. */
export const findNodeLabel = (nodes: TreeNode[], id: string): string | null => {
  for (const n of nodes) {
    if (n.id === id) return n.label;
    const found = findNodeLabel(n.children, id);
    if (found) return found;
  }
  return null;
};

import { PublishFolderNode } from '../models/publish';

/**
 * Returns the subset of `items` whose name matches `query`, or that contain a
 * descendant whose name matches. Matched branches keep only their matching
 * descendants. Matching is case-insensitive substring matching.
 */
export const filterFolderTree = (
  items: PublishFolderNode[],
  query: string,
): PublishFolderNode[] => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return items;
  }

  return items.reduce<PublishFolderNode[]>((acc, node) => {
    const filteredChildren = node.children
      ? filterFolderTree(node.children, query)
      : undefined;
    const selfMatches = node.name.toLowerCase().includes(trimmed);

    if (selfMatches) {
      acc.push(node);
    } else if (filteredChildren?.length) {
      acc.push({ ...node, children: filteredChildren });
    }

    return acc;
  }, []);
};

/** Returns every folder path (joined by "/") in `items`, recursively. */
export const collectFolderKeys = (items: PublishFolderNode[]): string[] =>
  items.flatMap((node) => [
    node.path.join('/'),
    ...(node.children ? collectFolderKeys(node.children) : []),
  ]);

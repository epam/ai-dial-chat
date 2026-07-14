import { DialFile, DialFileNodeType } from '@epam/ai-dial-ui-kit';
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

/** Joins folder path segments into the string path key used by `DialFile`/`DialFoldersTree`. */
export const toFolderPathKey = (path: string[]): string => path.join('/');

/** Splits a `DialFile`/`DialFoldersTree` string path back into folder path segments. */
export const fromFolderPathKey = (pathKey: string): string[] =>
  pathKey.split('/').filter(Boolean);

/**
 * Converts `PublishFolderNode[]` to the `DialFile[]` shape `DialFoldersTree`
 * requires. `folderId` is required by `DialFile` but unused for this
 * folder-only, context-menu-less tree, so it is set to the path key.
 */
export const toDialFileTree = (items: PublishFolderNode[]): DialFile[] =>
  items.map((node) => {
    const path = toFolderPathKey(node.path);
    return {
      path,
      name: node.name,
      folderId: path,
      nodeType: DialFileNodeType.FOLDER,
      items: node.children ? toDialFileTree(node.children) : undefined,
    };
  });

/**
 * Inserts a placeholder `DialFile` folder node so `DialFoldersTree` can
 * render its inline create-folder row for it (`createdFolderPath`). The
 * placeholder is never reported to `onCreateFolder` — only the name the
 * user confirms is.
 */
export const insertPlaceholderDialFile = (
  items: DialFile[],
  parentPath: string[],
  placeholderName: string,
): DialFile[] => {
  const placeholderPath = toFolderPathKey([...parentPath, placeholderName]);
  const placeholder: DialFile = {
    path: placeholderPath,
    name: placeholderName,
    folderId: placeholderPath,
    nodeType: DialFileNodeType.FOLDER,
  };

  if (parentPath.length === 0) {
    return [...items, placeholder];
  }

  const parentKey = toFolderPathKey(parentPath);
  return items.map((file) => {
    if (file.path !== parentKey) {
      return file.items
        ? {
            ...file,
            items: insertPlaceholderDialFile(
              file.items,
              parentPath,
              placeholderName,
            ),
          }
        : file;
    }
    return { ...file, items: [...(file.items ?? []), placeholder] };
  });
};

/** Names of the direct children of the folder at `parentPath` (root siblings when empty). */
export const getSiblingFolderNames = (
  items: PublishFolderNode[],
  parentPath: string[],
): string[] => {
  if (parentPath.length === 0) {
    return items.map((node) => node.name);
  }
  const parentKey = toFolderPathKey(parentPath);
  const findNode = (
    nodes: PublishFolderNode[],
  ): PublishFolderNode | undefined => {
    for (const node of nodes) {
      if (toFolderPathKey(node.path) === parentKey) {
        return node;
      }
      const found = node.children ? findNode(node.children) : undefined;
      if (found) {
        return found;
      }
    }
    return undefined;
  };
  return (findNode(items)?.children ?? []).map((node) => node.name);
};

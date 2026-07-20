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

/** Characters forbidden in a publish destination folder name, mirroring the backend's path validation rules. */
const FORBIDDEN_FOLDER_NAME_CHARS_RE = /[/\\:;,={}&"]/;

/** Error messages returned by {@link validateFolderName} for each rejection reason. */
export interface FolderNameValidationMessages {
  /** Shown when the trimmed name is empty. */
  empty: string;
  /** Shown when the name contains `..` or a forbidden character. */
  invalid: string;
  /** Shown when a sibling folder already has this name (case-insensitive). */
  duplicate: string;
}

/**
 * Validates a folder name entered in the publish destination tree. Returns an
 * error message from `messages`, or `null` when `rawValue` is a valid,
 * non-duplicate folder name.
 */
export const validateFolderName = (
  rawValue: string,
  siblingNames: string[],
  messages: FolderNameValidationMessages,
): string | null => {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return messages.empty;
  }
  if (trimmed.includes('..') || FORBIDDEN_FOLDER_NAME_CHARS_RE.test(trimmed)) {
    return messages.invalid;
  }
  if (
    siblingNames.some((name) => name.toLowerCase() === trimmed.toLowerCase())
  ) {
    return messages.duplicate;
  }
  return null;
};

/**
 * Returns `baseName` if no sibling already has that name, otherwise
 * `"${baseName} 2"`, `"${baseName} 3"`, etc. — the first suffix that is
 * free. Used so the inline create-folder editor starts with a name that does
 * not duplicate an existing sibling folder.
 */
export const getUniqueFolderName = (
  baseName: string,
  siblingNames: string[],
): string => {
  const lowerSiblingNames = new Set(
    siblingNames.map((name) => name.toLowerCase()),
  );
  if (!lowerSiblingNames.has(baseName.toLowerCase())) {
    return baseName;
  }
  let suffix = 2;
  while (lowerSiblingNames.has(`${baseName} ${suffix}`.toLowerCase())) {
    suffix += 1;
  }
  return `${baseName} ${suffix}`;
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

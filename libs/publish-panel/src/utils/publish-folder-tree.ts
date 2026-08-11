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

/*
 * Case-insensitive, digit-aware name comparison so "Folder 2" precedes
 * "Folder 10" and casing never splits otherwise-adjacent names.
 */
const compareFolderNames = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

/** Returns `items` ordered by folder name at every level; the input array and its nodes are left untouched. */
export const sortFolderTree = (
  items: PublishFolderNode[],
): PublishFolderNode[] =>
  [...items]
    .sort((a, b) => compareFolderNames(a.name, b.name))
    .map((node) =>
      node.children
        ? { ...node, children: sortFolderTree(node.children) }
        : node,
    );

const withFolderPath = (
  items: PublishFolderNode[],
  path: string[],
  parentPath: string[],
): PublishFolderNode[] => {
  const [name, ...rest] = path;
  if (name == null) {
    return items;
  }
  const nodePath = [...parentPath, name];
  const existing = items.find((node) => node.name === name);
  if (!existing) {
    return [
      ...items,
      {
        path: nodePath,
        name,
        children: rest.length
          ? withFolderPath([], rest, nodePath)
          : /* Leaf: children are unknown, not empty — same as a folder the host has not listed yet. */
            undefined,
      },
    ];
  }
  if (!rest.length) {
    return items;
  }
  return items.map((node) =>
    node === existing
      ? {
          ...node,
          children: withFolderPath(node.children ?? [], rest, nodePath),
        }
      : node,
  );
};

/**
 * Returns `items` with a folder node added for every path in `paths` that is
 * not already present, creating any missing ancestor along the way. Existing
 * nodes and their children are preserved as-is.
 */
export const mergeFolderPaths = (
  items: PublishFolderNode[],
  paths: string[][],
): PublishFolderNode[] =>
  paths.reduce(
    (acc, path) => (path.length ? withFolderPath(acc, path, []) : acc),
    items,
  );

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

/** Converts `PublishFolderNode[]` to the `DialFile[]` shape `DialFoldersTree` requires. */
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

/** Returns an error message from `messages`, or `null` when `rawValue` is a valid non-duplicate folder name for the publish destination tree. */
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

/** Returns `baseName` if no sibling already has that name, otherwise appends a number suffix (`2`, `3`, …) until the name is free. */
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

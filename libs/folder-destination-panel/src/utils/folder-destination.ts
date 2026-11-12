import type {
  FolderDestination,
  FolderDestinationRoot,
} from '../models/folder-destination';
import type { FolderNode } from '../models/folder-tree';
import { sortFolderTree, toFolderPathKey } from './folder-tree';

/*
 * A multi-root tree is rendered as one combined tree whose top-level nodes
 * are the roots. Each root's path starts with a token `:{key}`: `:` is a
 * forbidden folder-name character (see `validateFolderName`), so the token
 * can never collide with a real folder segment.
 */
const ROOT_TOKEN_PREFIX = ':';

/** Returns the first path segment that stands for the root `rootKey` in a combined multi-root tree. */
export const toRootToken = (rootKey: string): string =>
  `${ROOT_TOKEN_PREFIX}${rootKey}`;

const fromRootToken = (segment: string | undefined): string | undefined =>
  segment?.startsWith(ROOT_TOKEN_PREFIX)
    ? segment.slice(ROOT_TOKEN_PREFIX.length)
    : undefined;

/** Returns `destination` as a path in the combined multi-root tree. */
export const toRootedPath = (destination: FolderDestination): string[] => [
  toRootToken(destination.rootKey),
  ...destination.path,
];

/** Returns the destination a combined-tree path points at, or `undefined` when it does not start with a root token. */
export const fromRootedPath = (
  rootedPath: string[],
): FolderDestination | undefined => {
  const [first, ...path] = rootedPath;
  const rootKey = fromRootToken(first);
  return rootKey == null ? undefined : { rootKey, path };
};

const prefixNodes = (nodes: FolderNode[], token: string): FolderNode[] =>
  nodes.map((node) => ({
    ...node,
    path: [token, ...node.path],
    children: node.children ? prefixNodes(node.children, token) : undefined,
  }));

/** Returns one top-level node per root, in the given order, with each root's folders sorted by name and re-pathed under its token. */
export const buildRootedFolderTree = (
  roots: FolderDestinationRoot[],
): FolderNode[] =>
  roots.map((root) => {
    const token = toRootToken(root.key);
    return {
      path: [token],
      name: root.label,
      children: prefixNodes(sortFolderTree(root.items), token),
    };
  });

/** Returns the combined-tree path keys of every root node. */
export const getRootTokenKeys = (roots: FolderDestinationRoot[]): string[] =>
  roots.map((root) => toRootToken(root.key));

/** Returns the union of every root's `keys(root)`, translated to combined-tree path keys. */
export const joinRootedKeys = (
  roots: FolderDestinationRoot[],
  keys: (root: FolderDestinationRoot) => Set<string> | undefined,
): Set<string> => {
  const joined = new Set<string>();
  for (const root of roots) {
    const token = toRootToken(root.key);
    for (const key of keys(root) ?? []) {
      joined.add(key ? `${token}/${key}` : token);
    }
  }
  return joined;
};

/** Splits combined-tree path keys back into each root's own folder path keys; root nodes themselves are dropped. */
export const splitRootedKeys = (
  roots: FolderDestinationRoot[],
  keys: Set<string>,
): Map<string, Set<string>> => {
  const byRoot = new Map(
    roots.map((root) => [root.key, new Set<string>()] as const),
  );
  for (const key of keys) {
    const [first, ...rest] = key.split('/');
    const rootKey = fromRootToken(first);
    if (rootKey == null || rest.length === 0) continue;
    byRoot.get(rootKey)?.add(toFolderPathKey(rest));
  }
  return byRoot;
};

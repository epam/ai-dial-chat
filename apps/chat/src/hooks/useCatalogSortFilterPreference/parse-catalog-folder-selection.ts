import {
  CatalogFolderRootKind,
  type CatalogFolderSelection,
} from '@epam/ai-dial-catalog';

const ROOT_KINDS = new Set<string>(Object.values(CatalogFolderRootKind));

/** Returns the stored folder selection when it is well formed, or All entities (`{ path: [] }`) otherwise. */
export const parseCatalogFolderSelection = (
  value: unknown,
): CatalogFolderSelection => {
  if (value == null || typeof value !== 'object') return { path: [] };
  const { root, path } = value as { root?: unknown; path?: unknown };
  const isRootValid =
    root === undefined || (typeof root === 'string' && ROOT_KINDS.has(root));
  const isPathValid =
    Array.isArray(path) && path.every((segment) => typeof segment === 'string');
  if (!isRootValid || !isPathValid) return { path: [] };
  return root === undefined
    ? { path: [] }
    : { root: root as CatalogFolderRootKind, path: path as string[] };
};

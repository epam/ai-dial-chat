import type {
  FolderDestination,
  FolderDestinationRoot,
  FolderNode,
} from '@epam/ai-dial-folder-destination-panel';
import {
  fromFolderPathKey,
  toFolderPathKey,
} from '@epam/ai-dial-folder-destination-panel';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import {
  DialFileNodeType,
  DialFilePermission,
  DestinationFolderMode,
} from '@epam/ai-dial-react-file-manager';

/** Why a destination cannot be chosen for the items being copied or moved. */
export enum DestinationRestriction {
  /** The destination is the folder the items are already in. */
  SourceFolder = 'source-folder',
  /** A moved folder would end up inside itself or one of its subfolders. */
  IntoItself = 'into-itself',
}

const trimTrailingSlashes = (path: string): string => path.replace(/\/+$/, '');

const isFolder = (node: DialFile): boolean =>
  node.nodeType === DialFileNodeType.FOLDER;

/** Returns the folder children of `folder` as destination tree nodes whose paths are relative to the root. */
const toFolderNodes = (
  folder: DialFile,
  parentSegments: string[],
): FolderNode[] =>
  (folder.items ?? []).filter(isFolder).map((child) => {
    const path = [...parentSegments, child.name];
    return {
      path,
      name: child.name,
      children: toFolderNodes(child, path),
    };
  });

/** Returns the virtual path of the folder at `segments` inside `root`, e.g. `/My files/reports`. */
export const toDestinationVirtualPath = (
  root: DialFile,
  segments: string[],
): string => [trimTrailingSlashes(root.path), ...segments].join('/');

/** Returns the key a root is known by in a `FolderDestination`; it never contains `/`. */
export const getDestinationRootKey = (root: DialFile): string => root.name;

/**
 * Builds one destination root per top-level folder of the file manager's items.
 * `expandedByRoot` and `loadingVirtualPaths` are in the file manager's virtual-path space.
 */
export const buildDestinationRoots = (
  items: DialFile[],
  expandedByRoot: Map<string, Set<string>>,
  onExpandedPathsChange: (rootKey: string, paths: Set<string>) => void,
  loadingVirtualPaths: Set<string>,
): FolderDestinationRoot[] =>
  items.filter(isFolder).map((root) => {
    const key = getDestinationRootKey(root);
    const rootPath = trimTrailingSlashes(root.path);
    const loadingPaths = new Set<string>();
    for (const virtualPath of loadingVirtualPaths) {
      const normalized = trimTrailingSlashes(virtualPath);
      if (normalized.startsWith(`${rootPath}/`)) {
        loadingPaths.add(
          toFolderPathKey(normalized.slice(rootPath.length + 1).split('/')),
        );
      }
    }
    return {
      key,
      label: root.name,
      items: toFolderNodes(root, []),
      canCreateFolders:
        root.permissions?.includes(DialFilePermission.WRITE) ?? false,
      expandedPaths: expandedByRoot.get(key) ?? new Set<string>(),
      onExpandedPathsChange: (paths: Set<string>) =>
        onExpandedPathsChange(key, paths),
      loadingPaths,
    };
  });

/** Returns the destination for the folder at `virtualPath`, or `undefined` when it lies outside every root. */
export const findDestinationForVirtualPath = (
  items: DialFile[],
  virtualPath: string,
): FolderDestination | undefined => {
  const target = trimTrailingSlashes(virtualPath);
  for (const root of items.filter(isFolder)) {
    const rootPath = trimTrailingSlashes(root.path);
    if (target === rootPath) {
      return { rootKey: getDestinationRootKey(root), path: [] };
    }
    if (target.startsWith(`${rootPath}/`)) {
      return {
        rootKey: getDestinationRootKey(root),
        path: target.slice(rootPath.length + 1).split('/'),
      };
    }
  }
  return undefined;
};

/** Returns the virtual path of `destination`, or `undefined` when its root is not among `items`. */
export const getDestinationVirtualPath = (
  items: DialFile[],
  destination: FolderDestination,
): string | undefined => {
  const root = items
    .filter(isFolder)
    .find(
      (candidate) => getDestinationRootKey(candidate) === destination.rootKey,
    );
  return root ? toDestinationVirtualPath(root, destination.path) : undefined;
};

/** Returns the virtual path of the folder at the expanded path `key` of `rootKey`. */
export const getExpandedKeyVirtualPath = (
  items: DialFile[],
  rootKey: string,
  key: string,
): string | undefined =>
  getDestinationVirtualPath(items, {
    rootKey,
    path: fromFolderPathKey(key),
  });

/** Returns why `destinationPath` cannot receive `movedItems` or copies from `sourceFolder`, or `undefined` when it can. */
export const getDestinationRestriction = (
  mode: DestinationFolderMode,
  destinationPath: string,
  sourceFolder: string,
  items: DialFile[],
): DestinationRestriction | undefined => {
  const destination = trimTrailingSlashes(destinationPath);
  if (destination === trimTrailingSlashes(sourceFolder)) {
    return DestinationRestriction.SourceFolder;
  }
  if (mode === DestinationFolderMode.Move) {
    const isIntoItself = items.some((item) => {
      if (!isFolder(item)) return false;
      const itemPath = trimTrailingSlashes(item.path);
      return destination === itemPath || destination.startsWith(`${itemPath}/`);
    });
    if (isIntoItself) return DestinationRestriction.IntoItself;
  }
  return undefined;
};

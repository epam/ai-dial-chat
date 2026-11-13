import {
  toFolderPathKey,
  type FolderDestination,
  type FolderDestinationRoot,
  DialDestinationRequest,
  DialFile,
  DialUploadFileItem,
} from '@epam/ai-dial-react-file-manager';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildDestinationRoots,
  findDestinationForVirtualPath,
  getDestinationRestriction,
  getDestinationRootKey,
  getDestinationVirtualPath,
  getExpandedKeyVirtualPath,
  toDestinationVirtualPath,
  type DestinationRestriction,
} from '../dial-file-manager-destination.util';
import { RESERVED_MARKER_NAME } from '../dial-file-manager.model';

/** Inputs of `useFileManagerDestination`. */
export interface UseFileManagerDestinationParams {
  /** The Copy or Move the file manager raised. */
  request: DialDestinationRequest;
  /** The file manager's hierarchical items; each top-level folder becomes a destination root. */
  items: DialFile[];
  /** Virtual paths of folders currently being listed. */
  loadingPaths: Set<string>;
  /** Lists the folder at a virtual path when it is not cached. */
  onPreloadFolder: (virtualPath: string) => void;
  /** Creates the folder at `folderPath`; the marker file argument carries no information the controller reads. */
  onCreateFolder: (
    file: DialUploadFileItem,
    folderPath: string,
    fileId: string,
  ) => void | Promise<void>;
}

/** What a host needs to drive a folder destination panel for a file-manager Copy or Move. */
export interface UseFileManagerDestinationResult {
  /** One destination root per top-level folder, with the hierarchy expanded as the user opened it. */
  roots: FolderDestinationRoot[];
  /** The committed destination; starts on the folder the items are in. */
  destination: FolderDestination;
  /** Commits a destination picked in the tree and preloads its folder. */
  onDestinationChange: (destination: FolderDestination) => void;
  /** Creates a folder under `parentPath` of the root `rootKey`. */
  onCreateFolder: (
    rootKey: string,
    parentPath: string[],
    name: string,
  ) => Promise<void>;
  /** Virtual path of the destination, or `undefined` when its root is not among the items. */
  destinationVirtualPath: string | undefined;
  /** Whether the destination folder is still being listed. */
  isDestinationLoading: boolean;
  /** Why the destination cannot receive the items, or `undefined` when it can. */
  restriction: DestinationRestriction | undefined;
}

/** Returns the roots, destination and validity of a file-manager Copy or Move destination picker. */
export const useFileManagerDestination = ({
  request,
  items,
  loadingPaths,
  onPreloadFolder,
  onCreateFolder,
}: UseFileManagerDestinationParams): UseFileManagerDestinationResult => {
  /*
   * The destination the panel opens on is derived from the items, not stored,
   * so items that arrive after the request was raised are honoured; only a
   * pick the user made is state.
   */
  const sourceDestination = useMemo(
    (): FolderDestination =>
      findDestinationForVirtualPath(items, request.sourceFolder) ?? {
        rootKey: items[0] ? getDestinationRootKey(items[0]) : '',
        path: [],
      },
    [items, request.sourceFolder],
  );
  const [pickedDestination, setPickedDestination] = useState<
    FolderDestination | undefined
  >();
  const destination = pickedDestination ?? sourceDestination;

  /* The hierarchy opens along the path to the folder the items are in; what the user opens or closes overrides it. */
  const [expandedOverrides, setExpandedOverrides] = useState<
    Map<string, Set<string>>
  >(() => new Map());
  const expandedByRoot = useMemo(() => {
    const expanded = new Map<string, Set<string>>();
    if (sourceDestination.path.length > 0) {
      expanded.set(
        sourceDestination.rootKey,
        new Set(
          sourceDestination.path.map((_segment, index) =>
            toFolderPathKey(sourceDestination.path.slice(0, index + 1)),
          ),
        ),
      );
    }
    expandedOverrides.forEach((paths, rootKey) => expanded.set(rootKey, paths));
    return expanded;
  }, [sourceDestination, expandedOverrides]);

  const destinationVirtualPath = getDestinationVirtualPath(items, destination);

  /*
   * Folders are listed on demand, so whichever folder is the destination is
   * preloaded: the one the panel opens on, a later pick, and a source folder
   * that only appears once the items arrive.
   */
  const onPreloadFolderRef = useRef(onPreloadFolder);
  onPreloadFolderRef.current = onPreloadFolder;
  useEffect(() => {
    if (destinationVirtualPath)
      onPreloadFolderRef.current(destinationVirtualPath);
  }, [destinationVirtualPath]);

  const handleExpandedPathsChange = useCallback(
    (rootKey: string, paths: Set<string>) => {
      const previous = expandedByRoot.get(rootKey) ?? new Set<string>();
      paths.forEach((key) => {
        if (previous.has(key)) return;
        const virtualPath = getExpandedKeyVirtualPath(items, rootKey, key);
        if (virtualPath) onPreloadFolder(virtualPath);
      });
      setExpandedOverrides((current) => new Map(current).set(rootKey, paths));
    },
    [expandedByRoot, items, onPreloadFolder],
  );

  const roots = useMemo(
    () =>
      buildDestinationRoots(
        items,
        expandedByRoot,
        handleExpandedPathsChange,
        loadingPaths,
      ),
    [expandedByRoot, handleExpandedPathsChange, items, loadingPaths],
  );

  const handleCreateFolder = useCallback(
    async (rootKey: string, parentPath: string[], name: string) => {
      const root = items.find(
        (candidate) => getDestinationRootKey(candidate) === rootKey,
      );
      if (!root) return;
      const marker = new File([], RESERVED_MARKER_NAME, { type: 'text/plain' });
      await onCreateFolder(
        { fileContent: marker, name: RESERVED_MARKER_NAME },
        toDestinationVirtualPath(root, [...parentPath, name]),
        '',
      );
    },
    [items, onCreateFolder],
  );

  const isDestinationLoading =
    destinationVirtualPath != null && loadingPaths.has(destinationVirtualPath);
  const restriction =
    destinationVirtualPath == null
      ? undefined
      : getDestinationRestriction(
          request.mode,
          destinationVirtualPath,
          request.sourceFolder,
          request.items,
        );

  return {
    roots,
    destination,
    onDestinationChange: setPickedDestination,
    onCreateFolder: handleCreateFolder,
    destinationVirtualPath,
    isDestinationLoading,
    restriction,
  };
};

import { useCallback, useMemo, useState } from 'react';
import { CatalogItem } from '../models/catalog-item';
import { PublishFolderNode, PublishHistoryEntry } from '../models/publish';

const insertFolder = (
  items: PublishFolderNode[],
  parentPath: string[],
  name: string,
): PublishFolderNode[] => {
  if (parentPath.length === 0) {
    return [...items, { path: [name], name }];
  }

  return items.map((node) => {
    if (node.path.join('/') !== parentPath.join('/')) {
      return {
        ...node,
        children: node.children
          ? insertFolder(node.children, parentPath, name)
          : node.children,
      };
    }
    return {
      ...node,
      children: [
        ...(node.children ?? []),
        { path: [...parentPath, name], name },
      ],
    };
  });
};

/** Options for {@link usePublishFlow}. */
export interface UsePublishFlowOptions {
  /** The catalog entity being published. */
  item: CatalogItem;
  /** Previously published versions for this entity. */
  history: PublishHistoryEntry[];
  /** Root-level destination folder nodes, as currently known to the host. */
  folderItems: PublishFolderNode[];
  /**
   * Resolves whether the current user can publish to a given folder path.
   * Defaults to always allowing (`() => true`) when omitted.
   */
  hasWriteAccess?: (folderPath: string[]) => boolean;
  /**
   * Called when the user confirms a new folder name. The host owns
   * persisting the folder; the hook also adds it locally so it is
   * immediately selectable within this session.
   */
  onCreateFolder?: (parentPath: string[], name: string) => void;
  /** Called with the destination folder path when the user confirms publish/update. */
  onPublish: (item: CatalogItem, folderPath: string[]) => Promise<void>;
  /** Called after a successful publish; the host surfaces its own success notification. */
  onPublishSuccess?: (item: CatalogItem, folderPath: string[]) => void;
}

/** State and handlers returned by {@link usePublishFlow}. */
export interface UsePublishFlowResult {
  /** Folder tree, including any folders created (but not yet persisted) during this session. */
  folderItems: PublishFolderNode[];
  /** Currently selected destination folder path. */
  selectedFolderPath?: string[];
  /** Selects a destination folder. */
  setSelectedFolderPath: (path: string[]) => void;
  /** Confirms a new folder name: adds it locally and reports it to the host. */
  handleCreateFolder: (parentPath: string[], name: string) => void;
  /** Whether `item.version` is already published at `selectedFolderPath`. */
  hasExistingVersionInFolder: boolean;
  /** Whether the current user can publish to `selectedFolderPath`. */
  hasWriteAccess: boolean;
  /** Whether a publish request is currently in flight. */
  isSubmitting: boolean;
  /** Submits the publish/update request for the selected folder. */
  handleSubmit: () => Promise<void>;
  /** Resets folder selection and any locally-created folders back to `folderItems`. */
  reset: () => void;
}

/**
 * Drives the Publish flow's state: destination-folder selection, optimistic
 * local folder creation, existing-version detection, and submit handling.
 * Framework for both in-place (DetailsPanel) and popup presentations.
 */
export const usePublishFlow = ({
  item,
  history,
  folderItems: initialFolderItems,
  hasWriteAccess: resolveWriteAccess = () => true,
  onCreateFolder,
  onPublish,
  onPublishSuccess,
}: UsePublishFlowOptions): UsePublishFlowResult => {
  const [folderItems, setFolderItems] = useState(initialFolderItems);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string[]>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasExistingVersionInFolder = useMemo(() => {
    if (!selectedFolderPath) {
      return false;
    }
    const key = selectedFolderPath.join('/');
    return history.some(
      (entry) =>
        entry.version === item.version && entry.folderPath.join('/') === key,
    );
  }, [history, item.version, selectedFolderPath]);

  const handleCreateFolder = useCallback(
    (parentPath: string[], name: string) => {
      setFolderItems((prev) => insertFolder(prev, parentPath, name));
      onCreateFolder?.(parentPath, name);
    },
    [onCreateFolder],
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedFolderPath) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onPublish(item, selectedFolderPath);
      onPublishSuccess?.(item, selectedFolderPath);
    } finally {
      setIsSubmitting(false);
    }
  }, [item, onPublish, onPublishSuccess, selectedFolderPath]);

  const reset = useCallback(() => {
    setFolderItems(initialFolderItems);
    setSelectedFolderPath(undefined);
  }, [initialFolderItems]);

  return {
    folderItems,
    selectedFolderPath,
    setSelectedFolderPath,
    handleCreateFolder,
    hasExistingVersionInFolder,
    hasWriteAccess: selectedFolderPath
      ? resolveWriteAccess(selectedFolderPath)
      : true,
    isSubmitting,
    handleSubmit,
    reset,
  };
};

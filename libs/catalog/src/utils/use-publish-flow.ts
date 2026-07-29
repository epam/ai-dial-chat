import { useCallback, useEffect, useMemo, useState } from 'react';
import { CatalogItem } from '../models/catalog-item';
import { PublishFolderNode, PublishHistoryEntry } from '../models/publish';

/** An item publishable through {@link usePublishFlow} — versioned (`CatalogItem`) or not (e.g. a conversation). */
export interface PublishFlowItem {
  /** Version, when the item is versioned. `undefined` for unversioned resources. */
  version?: string;
}

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

/** Reverses {@link insertFolder}, used to roll back an optimistic folder add when `onCreateFolder` rejects. */
const removeFolder = (
  items: PublishFolderNode[],
  parentPath: string[],
  name: string,
): PublishFolderNode[] => {
  const targetKey = [...parentPath, name].join('/');
  if (parentPath.length === 0) {
    return items.filter((node) => node.path.join('/') !== targetKey);
  }

  return items.map((node) => {
    if (node.path.join('/') !== parentPath.join('/')) {
      return {
        ...node,
        children: node.children
          ? removeFolder(node.children, parentPath, name)
          : node.children,
      };
    }
    return {
      ...node,
      children: (node.children ?? []).filter(
        (child) => child.path.join('/') !== targetKey,
      ),
    };
  });
};

/** Options for {@link usePublishFlow}. */
export interface UsePublishFlowOptions<TItem extends PublishFlowItem> {
  /** The item being published — a `CatalogItem` (versioned) or an unversioned resource (e.g. a conversation). */
  item: TItem;
  /** Previously published entries for this item. */
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
   * immediately selectable within this session. If the returned promise
   * rejects, the optimistically added folder is rolled back and the submit-
   * error callout is surfaced.
   */
  onCreateFolder?: (parentPath: string[], name: string) => void | Promise<void>;
  /** Called with the destination folder path when the user confirms publish/update. */
  onPublish: (item: TItem, folderPath: string[]) => Promise<void>;
  /** Called after a successful publish; the host surfaces its own success notification. */
  onPublishSuccess?: (item: TItem, folderPath: string[]) => void;
}

/** State and handlers returned by {@link usePublishFlow}. */
export interface UsePublishFlowResult {
  /** Folder tree, including any folders created (but not yet persisted) during this session. */
  folderItems: PublishFolderNode[];
  /**
   * Currently selected destination folder path. `undefined` means nothing
   * is selected; `[]` means the bucket root itself is selected (a distinct,
   * valid destination).
   */
  selectedFolderPath?: string[];
  /** Selects a destination folder or the root (`[]`); pass `undefined` to deselect. */
  setSelectedFolderPath: (path: string[] | undefined) => void;
  /** Confirms a new folder name: adds it locally and reports it to the host, rolling back and surfacing an error if the host rejects. */
  handleCreateFolder: (parentPath: string[], name: string) => Promise<void>;
  /**
   * Whether `selectedFolderPath` already has this publication — this exact
   * version, for a versioned item, or any prior entry at all, for an
   * unversioned item (whose `version` is `undefined`).
   */
  hasExistingPublicationInFolder: boolean;
  /** Whether the current user can publish to `selectedFolderPath`. */
  hasWriteAccess: boolean;
  /** Whether a publish request is currently in flight. */
  isSubmitting: boolean;
  /** Whether the most recent submit attempt failed. */
  hasSubmitError: boolean;
  /**
   * Submits the publish/update request for the selected folder. Resolves to
   * `true` on success and `false` if `onPublish` rejected, so the caller can
   * decide whether to close the flow.
   */
  handleSubmit: () => Promise<boolean>;
  /** Resets folder selection, any locally-created folders, and the submit error back to their initial state. */
  reset: () => void;
}

/** Manages all state for the Publish flow: folder selection, local folder creation, existing-publication detection, and submit handling. */
export const usePublishFlow = <TItem extends PublishFlowItem = CatalogItem>({
  item,
  history,
  folderItems: initialFolderItems,
  hasWriteAccess: resolveWriteAccess = () => true,
  onCreateFolder,
  onPublish,
  onPublishSuccess,
}: UsePublishFlowOptions<TItem>): UsePublishFlowResult => {
  const [folderItems, setFolderItems] = useState(initialFolderItems);
  useEffect(() => {
    setFolderItems(initialFolderItems);
  }, [initialFolderItems]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string[]>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitError, setHasSubmitError] = useState(false);

  const hasExistingPublicationInFolder = useMemo(() => {
    if (!selectedFolderPath) {
      return false;
    }
    const key = selectedFolderPath.join('/');
    return history.some((entry) => {
      if (entry.folderPath.join('/') !== key) {
        return false;
      }
      return item.version == null ? true : entry.version === item.version;
    });
  }, [history, item.version, selectedFolderPath]);

  const handleCreateFolder = useCallback(
    async (parentPath: string[], name: string) => {
      setFolderItems((prev) => insertFolder(prev, parentPath, name));
      try {
        await onCreateFolder?.(parentPath, name);
      } catch {
        setFolderItems((prev) => removeFolder(prev, parentPath, name));
        setHasSubmitError(true);
      }
    },
    [onCreateFolder],
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedFolderPath) {
      return false;
    }
    setIsSubmitting(true);
    setHasSubmitError(false);
    try {
      await onPublish(item, selectedFolderPath);
      onPublishSuccess?.(item, selectedFolderPath);
      return true;
    } catch {
      setHasSubmitError(true);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [item, onPublish, onPublishSuccess, selectedFolderPath]);

  const reset = useCallback(() => {
    setFolderItems(initialFolderItems);
    setSelectedFolderPath(undefined);
    setHasSubmitError(false);
  }, [initialFolderItems]);

  return {
    folderItems,
    selectedFolderPath,
    setSelectedFolderPath,
    handleCreateFolder,
    hasExistingPublicationInFolder,
    hasWriteAccess: selectedFolderPath
      ? resolveWriteAccess(selectedFolderPath)
      : true,
    isSubmitting,
    hasSubmitError,
    handleSubmit,
    reset,
  };
};

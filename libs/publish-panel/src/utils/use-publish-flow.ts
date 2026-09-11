import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PublicationRule,
  PublishFolderNode,
  PublishHistoryEntry,
} from '../models/publish';

/** An item publishable through {@link usePublishFlow} — versioned or not (e.g. a conversation). */
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
  /** The item being published — versioned, or an unversioned resource (e.g. a conversation). */
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
  /**
   * Initial value for the publication's display author, and the value
   * `reset` restores.
   *
   * The hook cannot resolve this itself: who the signed-in user is, is host
   * knowledge, and this library holds no notion of a session. The host
   * passes its own resolved display name here. It may arrive after the first
   * render (a profile still loading) or change (a different session), which
   * is why {@link UsePublishFlowResult.author} re-syncs from it while the
   * user has not edited the field.
   *
   * Defaults to `''`, which leaves the decision entirely to the host's own
   * publish call.
   */
  defaultAuthor?: string;
  /** Called with the destination folder path, current rules, and trimmed display author when the user confirms publish/update. */
  onPublish: (
    item: TItem,
    folderPath: string[],
    rules: PublicationRule[],
    author: string,
  ) => Promise<void>;
  /** Called after a successful publish; the host surfaces its own success notification. */
  onPublishSuccess?: (item: TItem, folderPath: string[]) => void;
  /**
   * Called with the rejection reason when `onPublish` fails, before
   * `handleSubmit` resolves to `false`. The host surfaces its own error
   * notification; the hook only sets `hasSubmitError` for the inline callout.
   */
  onPublishError?: (item: TItem, folderPath: string[], error: unknown) => void;
  /**
   * Resolves the access rules already configured for a destination folder.
   * Called whenever `selectedFolderPath` changes to a defined folder; the
   * result fully replaces the current `rules` state (never merged). Omit to
   * skip pre-filling entirely — `rules` then only ever changes via
   * `setRules`.
   */
  onFetchExistingRules?: (folderPath: string[]) => Promise<PublicationRule[]>;
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
  /** Resets folder selection, any locally-created folders, rules, and the submit error back to their initial state. */
  reset: () => void;
  /** Current access rules for the selected folder — fetched, manually edited, or both. */
  rules: PublicationRule[];
  /** Replaces the current rules; used by manual add/remove/clear actions. */
  setRules: (rules: PublicationRule[]) => void;
  /**
   * Current display author for the publication — the host-supplied
   * `defaultAuthor` until the user edits it.
   */
  author: string;
  /** Replaces the current display author; marks the field as user-edited, so `defaultAuthor` no longer overwrites it. */
  setAuthor: (author: string) => void;
  /** Whether `onFetchExistingRules` is currently resolving for the selected folder. */
  isRulesLoading: boolean;
  /** Whether the most recent `onFetchExistingRules` call failed. `rules` is left unchanged when this is `true`. */
  hasRulesLoadError: boolean;
}

/** Manages all state for the Publish flow: folder selection, local folder creation, existing-publication detection, and submit handling. */
export const usePublishFlow = <
  TItem extends PublishFlowItem = PublishFlowItem,
>({
  item,
  history,
  folderItems: initialFolderItems,
  hasWriteAccess: resolveWriteAccess = () => true,
  defaultAuthor = '',
  onCreateFolder,
  onPublish,
  onPublishSuccess,
  onPublishError,
  onFetchExistingRules,
}: UsePublishFlowOptions<TItem>): UsePublishFlowResult => {
  const [folderItems, setFolderItems] = useState(initialFolderItems);
  useEffect(() => {
    setFolderItems(initialFolderItems);
  }, [initialFolderItems]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string[]>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitError, setHasSubmitError] = useState(false);
  const [rules, setRules] = useState<PublicationRule[]>([]);
  const [isRulesLoading, setIsRulesLoading] = useState(false);
  const [hasRulesLoadError, setHasRulesLoadError] = useState(false);
  const [author, setAuthorState] = useState(defaultAuthor);
  /*
   * Seeding `author` once would strand the field empty whenever the host's
   * display name resolves after the first render; syncing it on every
   * `defaultAuthor` change would wipe what the user typed. Tracking whether
   * the user has touched the field is what makes the sync one-way and
   * one-shot.
   */
  const [isAuthorEdited, setIsAuthorEdited] = useState(false);
  useEffect(() => {
    if (isAuthorEdited) {
      return;
    }
    setAuthorState(defaultAuthor);
  }, [defaultAuthor, isAuthorEdited]);

  const setAuthor = useCallback((next: string) => {
    setIsAuthorEdited(true);
    setAuthorState(next);
  }, []);

  useEffect(() => {
    if (selectedFolderPath == null) {
      setRules([]);
      setHasRulesLoadError(false);
      return;
    }
    if (!onFetchExistingRules) {
      return;
    }

    let isCancelled = false;
    setIsRulesLoading(true);
    setHasRulesLoadError(false);

    onFetchExistingRules(selectedFolderPath)
      .then((fetchedRules) => {
        if (isCancelled) return;
        setRules(fetchedRules);
      })
      .catch(() => {
        if (isCancelled) return;
        setHasRulesLoadError(true);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsRulesLoading(false);
      });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderPath]);

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
      await onPublish(item, selectedFolderPath, rules, author.trim());
      onPublishSuccess?.(item, selectedFolderPath);
      return true;
    } catch (error) {
      setHasSubmitError(true);
      onPublishError?.(item, selectedFolderPath, error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    author,
    item,
    onPublish,
    onPublishError,
    onPublishSuccess,
    rules,
    selectedFolderPath,
  ]);

  const reset = useCallback(() => {
    setFolderItems(initialFolderItems);
    setSelectedFolderPath(undefined);
    setHasSubmitError(false);
    setRules([]);
    setHasRulesLoadError(false);
    setAuthorState(defaultAuthor);
    setIsAuthorEdited(false);
  }, [defaultAuthor, initialFolderItems]);

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
    rules,
    setRules,
    author,
    setAuthor,
    isRulesLoading,
    hasRulesLoadError,
  };
};

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /**
   * Called with the destination folder path, current rules, trimmed display
   * author, and the credentials opt-in when the user confirms publish/update.
   *
   * `publishCredentials` is additive and positional: a host callback that
   * declares only the first four parameters stays assignable and keeps
   * behaving exactly as it did.
   */
  onPublish: (
    item: TItem,
    folderPath: string[],
    rules: PublicationRule[],
    author: string,
    publishCredentials: boolean,
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
  /**
   * Resolves whether another resource already holds the published path of
   * `item` in a destination folder, so the panel can say so before submit.
   * Called when the selected folder changes to a defined folder and when
   * `item.version` changes while one is selected; never for a folder created
   * in this session, nor for a folder where this item's own history already
   * holds it. An answer that arrives after the folder or version changed again
   * is discarded. A rejection leaves the target untaken and does not block
   * submit: the backend's refusal on submit is the safety net. Omit to skip
   * the check entirely.
   */
  onCheckTargetExists?: (item: TItem, folderPath: string[]) => Promise<boolean>;
  /**
   * Tells whether the rejection of `onPublish` means the target is taken. When
   * it returns `true` the hook marks the selected folder's target as taken
   * instead of setting `hasSubmitError`, so the panel shows the same callout as
   * after the check; `onPublishError` is still called. Must be synchronous: a
   * host that learns the cause asynchronously converts the error inside its
   * `onPublish` before rethrowing it.
   */
  isTargetTakenError?: (error: unknown) => boolean;
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
  /** Resets folder selection, any locally-created folders, rules, the credentials opt-in, and the submit error back to their initial state. */
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
  /**
   * Whether the publication should carry the publisher's own credentials for
   * the item. Starts `false` and is never derived from history, the selected
   * folder, or a previous publication — selecting it is always a deliberate
   * act, so a folder whose previous publication carried credentials still
   * opens with it cleared.
   */
  publishCredentials: boolean;
  /** Replaces the credentials opt-in. */
  setPublishCredentials: (value: boolean) => void;
  /**
   * Whether another resource holds the published path in `selectedFolderPath`:
   * `onCheckTargetExists` answered `true` for the current folder and version,
   * or the last submit was rejected as a taken target.
   */
  isTargetTaken: boolean;
  /** Whether `onCheckTargetExists` is currently resolving for the selected folder and version. */
  isTargetChecking: boolean;
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
  onCheckTargetExists,
  isTargetTakenError,
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
  const [publishCredentials, setPublishCredentials] = useState(false);
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

  /*
   * A folder created in this session holds nothing yet, and neither does
   * anything beneath it, so it cannot collide and is not checked.
   */
  const createdFolderKeys = useRef(new Set<string>());
  const [takenKey, setTakenKey] = useState<string>();
  const [isTargetChecking, setIsTargetChecking] = useState(false);
  const targetKey =
    selectedFolderPath == null
      ? undefined
      : `${selectedFolderPath.join('/')}\u0000${item.version ?? ''}`;
  const isTargetTaken = targetKey != null && takenKey === targetKey;

  useEffect(() => {
    if (
      selectedFolderPath == null ||
      targetKey == null ||
      !onCheckTargetExists ||
      hasExistingPublicationInFolder
    ) {
      setIsTargetChecking(false);
      return;
    }
    const folderKey = selectedFolderPath.join('/');
    const isInCreatedFolder = [...createdFolderKeys.current].some(
      (created) => folderKey === created || folderKey.startsWith(`${created}/`),
    );
    if (isInCreatedFolder) {
      setIsTargetChecking(false);
      return;
    }

    let isCancelled = false;
    setIsTargetChecking(true);
    onCheckTargetExists(item, selectedFolderPath)
      .then((isTaken) => {
        if (isCancelled) return;
        setTakenKey((previous) => {
          if (isTaken) return targetKey;
          return previous === targetKey ? undefined : previous;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!isCancelled) setIsTargetChecking(false);
      });

    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, hasExistingPublicationInFolder, onCheckTargetExists == null]);

  const handleCreateFolder = useCallback(
    async (parentPath: string[], name: string) => {
      const createdKey = [...parentPath, name].join('/');
      createdFolderKeys.current.add(createdKey);
      setFolderItems((prev) => insertFolder(prev, parentPath, name));
      try {
        await onCreateFolder?.(parentPath, name);
      } catch {
        createdFolderKeys.current.delete(createdKey);
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
      await onPublish(
        item,
        selectedFolderPath,
        rules,
        author.trim(),
        publishCredentials,
      );
      onPublishSuccess?.(item, selectedFolderPath);
      return true;
    } catch (error) {
      if (isTargetTakenError?.(error) && targetKey != null) {
        setTakenKey(targetKey);
      } else {
        setHasSubmitError(true);
      }
      onPublishError?.(item, selectedFolderPath, error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    author,
    isTargetTakenError,
    item,
    onPublish,
    onPublishError,
    onPublishSuccess,
    publishCredentials,
    rules,
    selectedFolderPath,
    targetKey,
  ]);

  const reset = useCallback(() => {
    setFolderItems(initialFolderItems);
    setSelectedFolderPath(undefined);
    setHasSubmitError(false);
    setRules([]);
    setHasRulesLoadError(false);
    setAuthorState(defaultAuthor);
    setIsAuthorEdited(false);
    setPublishCredentials(false);
    createdFolderKeys.current.clear();
    setTakenKey(undefined);
    setIsTargetChecking(false);
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
    publishCredentials,
    setPublishCredentials,
    isTargetTaken,
    isTargetChecking,
    isRulesLoading,
    hasRulesLoadError,
  };
};

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  resolveUnpublishableFolders,
  type UnpublishableFoldersClient,
  type UnpublishTarget,
} from '../unpublishable-folders';

/** What `useUnpublishableFolders` reports. */
export interface UnpublishableFoldersState {
  /** `false` while the lookup for the current entity is in flight. */
  isResolved: boolean;
  /** Folders the caller may unpublish the entity from, as path segments, newest first; empty until resolved. */
  folders: string[][];
  /** Re-runs the lookup, keeping the folders already reported until it succeeds; a failed re-run keeps them. */
  refresh: () => void;
}

const EMPTY_FOLDERS: string[][] = [];

interface ResolvedFolders {
  /** The entity the folders belong to; a mismatch means "not resolved". */
  key: string | null;
  folders: string[][];
}

const toTargetKey = (target: UnpublishTarget | null): string | null =>
  target == null ? null : `${target.entityType}:${target.entityId}`;

/**
 * Tracks the folders the caller may unpublish one entity from, through
 * `resolveUnpublishableFolders`. A failed first lookup settles as no folders,
 * a failed `refresh` keeps the folders already reported, and a response for an
 * entity the host has moved away from is dropped.
 *
 * @param client - Configured publish requests, from `createPublishApiClient`; it must be referentially stable.
 * @param target - The entity to check, or `null` while none is loaded.
 * @param isAdmin - Whether the session user is a DIAL administrator.
 */
export const useUnpublishableFolders = (
  client: UnpublishableFoldersClient,
  target: UnpublishTarget | null,
  isAdmin: boolean,
): UnpublishableFoldersState => {
  const entityType = target?.entityType ?? null;
  const entityId = target?.entityId ?? null;
  const isOwner = target?.isOwner ?? false;
  const key = toTargetKey(target);

  const [resolved, setResolved] = useState<ResolvedFolders>({
    key: null,
    folders: [],
  });
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    if (entityType == null || entityId == null) return;
    const requestKey = `${entityType}:${entityId}`;
    let isCancelled = false;
    const run = async () => {
      try {
        const folders = await resolveUnpublishableFolders(
          client,
          { entityType, entityId, isOwner },
          isAdmin,
        );
        if (!isCancelled) setResolved({ key: requestKey, folders });
      } catch {
        if (isCancelled) return;
        /*
         * A first lookup that fails settles silently as "not published":
         * nobody asked for history. A failed re-read of an entity already
         * resolved keeps its folders instead, so a transient error after an
         * unpublish request does not swap Unpublish back to Publish while the
         * copy is still live.
         */
        setResolved((previous) =>
          previous.key === requestKey
            ? previous
            : { key: requestKey, folders: [] },
        );
      }
    };
    void run();
    return () => {
      isCancelled = true;
    };
  }, [client, entityType, entityId, isOwner, isAdmin, refreshCount]);

  /* The state still names this entity, so a refresh keeps the folders shown. */
  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  const isResolved = key != null && resolved.key === key;
  const folders = isResolved ? resolved.folders : EMPTY_FOLDERS;

  return useMemo(
    () => ({ isResolved, folders, refresh }),
    [folders, isResolved, refresh],
  );
};

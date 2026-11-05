import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PublishApiClient } from './create-publish-api';
import {
  type CatalogPublishEntityType,
  getPublicCatalogEntityFolderPath,
  isPublicCatalogEntityId,
  mapPublishHistoryEntryDto,
} from './publish';

/** The requests `resolveUnpublishableFolders` and `useUnpublishableFolders` issue. */
export type UnpublishableFoldersClient = Pick<
  PublishApiClient,
  'getCatalogPublishHistory' | 'getCatalogUnpublishAccess'
>;

/** A published entity whose removal the caller may request. */
export interface UnpublishTarget {
  /** The publish API's entity type, e.g. `'project'`. */
  entityType: CatalogPublishEntityType;
  /** The entity's DIAL Core id: the caller's own source or a `{type}/public/…` copy. */
  entityId: string;
  /** Whether the caller owns the source entity in their own bucket. */
  isOwner: boolean;
}

/** What `useUnpublishableFolders` reports. */
export interface UnpublishableFoldersState {
  /** `false` while the lookup for the current entity is in flight. */
  isResolved: boolean;
  /** Folders the caller may unpublish the entity from, as path segments, newest first; empty until resolved. */
  folders: string[][];
  /** Re-runs the lookup, keeping the folders already reported until it settles. */
  refresh: () => void;
}

const dedupeFolders = (folders: string[][]): string[][] => {
  const seen = new Set<string>();
  return folders.filter((folder) => {
    const key = folder.join('/');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Returns the folders the caller may request removal of `target` from: an
 * owner's live published folders from publish history; on a public copy its
 * own folder, for an administrator outright and for anyone else only when the
 * BFF confirms they published it; otherwise none. Rejects when a request fails.
 */
export const resolveUnpublishableFolders = async (
  client: UnpublishableFoldersClient,
  target: UnpublishTarget,
  isAdmin: boolean,
): Promise<string[][]> => {
  const { entityType, entityId, isOwner } = target;
  /* A public id already names its one folder; publish history is keyed by the source and finds nothing for it. */
  if (isPublicCatalogEntityId(entityId)) {
    if (!isAdmin) {
      const { canUnpublish } = await client.getCatalogUnpublishAccess(
        entityType,
        entityId,
      );
      if (!canUnpublish) return [];
    }
    return [getPublicCatalogEntityFolderPath(entityId)];
  }
  if (!isOwner) return [];
  const entries = await client.getCatalogPublishHistory(entityType, entityId);
  /* The same folder twice (republished there) is offered once. */
  return dedupeFolders(
    entries.map((entry) => mapPublishHistoryEntryDto(entry).folderPath),
  );
};

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
 * `resolveUnpublishableFolders`. A failed lookup settles as no folders, and a
 * response for an entity the host has moved away from is dropped.
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
      let folders: string[][];
      try {
        folders = await resolveUnpublishableFolders(
          client,
          { entityType, entityId, isOwner },
          isAdmin,
        );
      } catch {
        /* Nobody asked for history: settle silently as "not published". */
        folders = [];
      }
      if (!isCancelled) setResolved({ key: requestKey, folders });
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

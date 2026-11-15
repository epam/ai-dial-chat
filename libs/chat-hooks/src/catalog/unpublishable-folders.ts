import type { PublishApiClient } from './create-publish-api';
import {
  type CatalogPublishEntityType,
  getPublicCatalogEntityFolderPath,
  isPublicCatalogEntityId,
  mapPublishHistoryEntryDto,
} from './publish';

/** The requests `resolveUnpublishableFolders` issues. */
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

export interface ResourceOwnershipFlags {
  isMy: boolean;
  canEdit: boolean;
  sharedWithMe: boolean;
}

/**
 * Computes ownership flags for a bucket-scoped DIAL Core resource id shaped
 * `{resourceType}/{bucket}/{name}` (e.g. `applications/{bucket}/my-app`,
 * `toolsets/{bucket}/my-toolset`). Shared by `DeploymentsService` and
 * `ToolsetsService` so a change to ownership semantics (a new permission
 * tier, a different bucket-membership check) is made in one place instead
 * of two independently-maintained copies.
 */
export const computeItemOwnershipFlags = (
  itemId: string,
  bucket: string,
  writableUrls: Set<string>,
  sharedUrls: Set<string>,
): ResourceOwnershipFlags => {
  const isMy = Boolean(bucket) && itemId.split('/')[1] === bucket;
  return {
    isMy,
    canEdit: isMy || writableUrls.has(itemId),
    sharedWithMe: !isMy && sharedUrls.has(itemId),
  };
};

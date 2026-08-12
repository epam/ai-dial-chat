export interface ResourceOwnershipFlags {
  isMy: boolean;
  canEdit: boolean;
  sharedWithMe: boolean;
}

export interface ResourceOwnershipUrlSets {
  writableUrls: Set<string>;
  sharedUrls: Set<string>;
}

/*
 * DIAL Core ids for these resource types are always `{type}/{bucket}/{name}`
 * — bucket at segment [1]. Deliberately NOT reused from
 * `publish-target.util.ts`'s `getResourceBucket` (`split('/')[1]` with no
 * prefix check): that helper is only ever called on already-prefixed
 * publish-flow ids, whereas deployments/toolsets ownership must also handle
 * the ambiguous, prefix-less id DIAL Core can return for a root-level/copied
 * toolset (`{bucket}/{name}`, bucket at segment [0] — see
 * `DeploymentsService.fetchDeploymentDetails`'s doc comment). Reusing
 * `getResourceBucket` here would silently misidentify the bucket for that
 * shape, so the prefix check below stays local to this module.
 */
const KNOWN_RESOURCE_TYPE_PREFIXES = new Set(['applications', 'toolsets']);

const getOwnerBucketSegment = (itemId: string): string | undefined => {
  const segments = itemId.split('/');
  const bucketIndex = KNOWN_RESOURCE_TYPE_PREFIXES.has(segments[0]) ? 1 : 0;
  return segments[bucketIndex];
};

/**
 * Computes ownership flags for a DIAL Core resource id, prefixed
 * (`applications/{bucket}/my-app`, `toolsets/{bucket}/my-toolset`) or not
 * (an ambiguous root-level/copied toolset id, `{bucket}/my-toolset`).
 * Shared by `DeploymentsService` and `ToolsetsService` so a change to
 * ownership semantics (a new permission tier, a different bucket-membership
 * check) is made in one place instead of two independently-maintained
 * copies.
 */
export const computeItemOwnershipFlags = (
  itemId: string,
  bucket: string,
  { writableUrls, sharedUrls }: ResourceOwnershipUrlSets,
): ResourceOwnershipFlags => {
  const isMy = Boolean(bucket) && getOwnerBucketSegment(itemId) === bucket;
  return {
    isMy,
    canEdit: isMy || writableUrls.has(itemId),
    sharedWithMe: !isMy && sharedUrls.has(itemId),
  };
};

/**
 * Splits a flat `getSharedResources` result into the two URL sets ownership
 * enrichment needs. Shared by `DeploymentsService` (applications, toolsets)
 * and `ToolsetsService` (toolsets) — each still issues its own
 * `getSharedResources` call with its own `resourceTypes` filter, since that
 * part is genuinely resource-type-specific.
 */
export const splitResourcesByPermission = (
  resources: { url?: string; permissions?: string[] }[],
): ResourceOwnershipUrlSets => {
  const writableUrls = new Set(
    resources
      .filter((resource) => resource.permissions?.includes('WRITE'))
      .map((resource) => resource.url)
      .filter((url): url is string => url != null),
  );
  const sharedUrls = new Set(
    resources
      .map((resource) => resource.url)
      .filter((url): url is string => url != null),
  );
  return { writableUrls, sharedUrls };
};

/**
 * Maps each resource url from a `getSharedResources({ with: 'others' })`
 * result to the number of users currently holding access to it.
 *
 * DIAL Core populates `sharedWith` only when the request sets
 * `includeUserInfo: true`, and only with users who have *accepted* an
 * invitation — an issued-but-unopened share link contributes nothing, so a
 * count of `0` means "nobody holds access", not "no link exists".
 */
export const countRecipientsByUrl = (
  resources: { url?: string; sharedWith?: unknown[] }[],
): Map<string, number> =>
  new Map(
    resources
      .filter((resource) => resource.url != null)
      .map((resource) => [
        resource.url as string,
        resource.sharedWith?.length ?? 0,
      ]),
  );

/**
 * Reads one resource's recipient count out of a {@link countRecipientsByUrl}
 * map, trying each candidate url in turn (list ids and share urls differ in
 * percent-encoding for some resource types).
 *
 * The two "no entry" cases mean opposite things and must not be conflated:
 * `counts === null` — the upstream call failed — yields `undefined`
 * ("unknown", so the UI keeps the revoke action reachable), while a lookup
 * that simply finds nothing in a *successful* response yields `0`, because
 * DIAL Core omits resources nobody currently holds.
 */
export const resolveRecipientsCount = (
  counts: Map<string, number> | null,
  ...urls: (string | undefined)[]
): number | undefined => {
  if (counts === null) return undefined;
  for (const url of urls) {
    const count = url == null ? undefined : counts.get(url);
    if (count != null) return count;
  }
  return 0;
};

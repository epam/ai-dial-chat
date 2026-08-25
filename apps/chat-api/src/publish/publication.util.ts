import type { Logger } from '@nestjs/common';
import { safeDecodeURIComponent } from '../common/utils/uri';

/**
 * Narrows DIAL Core's `getPublications` response to the publication array,
 * accepting both the bare array the SDK types and the `{ publications: [...] }`
 * envelope Core actually returns.
 *
 * The SDK declares `ListPublication = Publication[]`, but a live Core answers
 * with an object. Calling `.filter` straight on `result.data` therefore threw
 * `TypeError: (result.data ?? []).filter is not a function`, which
 * `handleDialFetchError` reported as "DIAL Core is currently unavailable"
 * (503) — the real cause behind
 * [GH #7897](https://github.com/epam/ai-dial-chat/issues/7897), which had been
 * attributed to Core being broken and led to both publish-history fetches being
 * stubbed out. Both shapes are accepted so realigning the SDK or Core later
 * cannot reintroduce the crash.
 *
 * An unrecognised shape yields an empty list and a warning rather than a throw:
 * publish history is informational, and a hard failure here takes down the
 * whole publish panel.
 */
export const toPublicationList = <T>(
  data: unknown,
  logger?: Logger,
  context?: string,
): T[] => {
  if (Array.isArray(data)) {
    return data as T[];
  }
  if (data != null && typeof data === 'object') {
    const { publications } = data as { publications?: unknown };
    if (Array.isArray(publications)) {
      return publications as T[];
    }
  }
  if (data != null) {
    logger?.warn(
      `Unexpected getPublications response shape${context ? ` for ${context}` : ''}: ${typeof data}`,
    );
  }
  return [];
};

/** DIAL Core's `Publication.status` lifecycle values. */
export enum PublicationStatus {
  Pending = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
}

/** DIAL Core's `PublicationResource.action` values. */
export enum PublicationResourceAction {
  Add = 'ADD',
  Delete = 'DELETE',
  AddIfAbsent = 'ADD_IF_ABSENT',
}

interface PublicationResourceLike {
  action?: string;
  sourceUrl?: string;
}

/** The subset of `Publication` this module reasons about. */
export interface PublicationLike {
  url?: string;
  status?: string;
  targetFolder?: string;
  createdAt?: number | string;
  resources?: PublicationResourceLike[];
}

/*
 * Core's list response carries publication metadata only, so every candidate
 * needs its own `getPublication` round trip. Bucket-wide lists of a few dozen
 * publications are normal (a shared dev Core returned 60), so the lookups are
 * batched rather than fired all at once.
 */
const PUBLICATION_DETAIL_CONCURRENCY = 8;

/**
 * Compares two DIAL resource urls tolerating a percent-encoding difference:
 * Core echoes `targetFolder` encoded (`public/New%20Folder/`), and a resource
 * url that came back encoded while the caller built it from plain text would
 * otherwise fail a strict `===` and silently yield an empty history.
 */
const isSameResourceUrl = (
  candidate: string | undefined,
  sourceUrl: string,
): boolean => {
  if (candidate == null) {
    return false;
  }
  if (candidate === sourceUrl) {
    return true;
  }
  return (
    safeDecodeURIComponent(candidate) === safeDecodeURIComponent(sourceUrl)
  );
};

/**
 * The action a publication applies to `sourceUrl`, or `null` when the
 * publication does not reference it at all.
 *
 * A resource with no `action` reads as `ADD` — Core's own default, and a
 * publication that lists a resource without one is publishing it. A
 * publication that both adds and removes the same source (Core has no such
 * flow, but the shape allows it) reports the publishing action, preserving
 * `publishesSource`'s original behaviour of matching *any* non-`DELETE`
 * resource.
 */
export const getPublicationSourceAction = (
  publication: PublicationLike,
  sourceUrl: string,
): PublicationResourceAction | null => {
  const resources =
    publication.resources?.filter((resource) =>
      isSameResourceUrl(resource.sourceUrl, sourceUrl),
    ) ?? [];
  if (resources.length === 0) {
    return null;
  }
  const publishing = resources.find(
    (resource) => resource.action !== PublicationResourceAction.Delete,
  );
  return publishing
    ? ((publishing.action as PublicationResourceAction | undefined) ??
        PublicationResourceAction.Add)
    : PublicationResourceAction.Delete;
};

/**
 * Whether `publication` publishes `sourceUrl`.
 *
 * A `DELETE` resource is a removal request submitted by an unpublish endpoint,
 * not a publication of the resource: counting it would list the folder twice —
 * once for the original `ADD`, once for the `DELETE` — and would read as a
 * second publish. While the removal is still `PENDING` the resource genuinely
 * is published there, so the folder stays, sourced from its `ADD` publication.
 * Once the removal is `APPROVED` that `ADD` is cancelled out too — see
 * `resolvePublicationsForSource`.
 */
export const publishesSource = (
  publication: PublicationLike,
  sourceUrl: string,
): boolean => {
  const action = getPublicationSourceAction(publication, sourceUrl);
  return action != null && action !== PublicationResourceAction.Delete;
};

/**
 * Whether `publication` requests the removal of `sourceUrl`.
 *
 * Says nothing about whether the removal has happened — that is `status`.
 */
export const removesSource = (
  publication: PublicationLike,
  sourceUrl: string,
): boolean =>
  getPublicationSourceAction(publication, sourceUrl) ===
  PublicationResourceAction.Delete;

/*
 * Whether a publication is worth a detail lookup. A missing `status` counts
 * as a candidate: the only publications that must be skipped are the ones
 * Core positively reports as `PENDING` or `REJECTED`.
 */
const isDetailCandidate = (status: string | undefined): boolean =>
  status == null || status === PublicationStatus.Approved;

/*
 * Whether a removal has actually taken effect, which requires Core to say so
 * outright — deliberately stricter than `isDetailCandidate`. Cancelling an
 * `ADD` on an *assumed* approval is the more expensive mistake: it would hide
 * Unpublish for a copy that is still live, and offer a Publish that Core then
 * rejects because the target already exists.
 */
const isApprovedRemoval = (status: string | undefined): boolean =>
  status === PublicationStatus.Approved;

/*
 * `Publication.createdAt` is epoch milliseconds in Core's schema, but the SDK
 * types it loosely and both publish services already tolerate a date string,
 * so both are accepted. An undateable publication falls back to the caller's
 * value, which is what decides which side of an ambiguity wins — see the
 * ordering comment in `resolvePublicationsForSource`.
 */
const toPublicationTime = (
  createdAt: number | string | undefined,
  fallback: number,
): number => {
  if (typeof createdAt === 'number') {
    return Number.isNaN(createdAt) ? fallback : createdAt;
  }
  if (typeof createdAt === 'string') {
    const parsed = Date.parse(createdAt);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
};

/**
 * Normalizes `Publication.targetFolder` into a comparable identity for the
 * published copy's folder: Core echoes it percent-encoded and always
 * trailing-slashed (`public/New%20Folder/`), and an `ADD` whose folder was
 * built from plain text must compare equal to the `DELETE` that removes it.
 */
const toTargetFolderKey = (targetFolder: string | undefined): string => {
  const decoded = safeDecodeURIComponent(targetFolder ?? '');
  return decoded.endsWith('/') ? decoded.slice(0, -1) : decoded;
};

/**
 * Narrows a bucket-wide publication list to the publications the resource is
 * *currently* published by, re-fetching each candidate's full record.
 *
 * `getPublications` returns publication **metadata** only — `url`, `status`,
 * `targetFolder`, `createdAt`, `author` — and no `resources` array. Filtering
 * the list response by `resources[].sourceUrl` therefore matched nothing: a
 * live Core answered with 60 publications and publish history still came back
 * empty, which hid Unpublish on an entity that was demonstrably published. The
 * composition of a publication is only available from `getPublication`, so each
 * candidate is fetched individually (Core has no per-resource filter on the
 * list call — see `getPublicationsListScope`).
 *
 * Only `APPROVED` publications are candidates. A `PENDING` request has not
 * created a published copy yet and a `REJECTED` one never will, so neither
 * describes a folder the resource is published to — and skipping them is what
 * keeps the number of detail lookups proportional to real publications.
 *
 * **An approved removal cancels the publication it removed.** Core keeps the
 * original `ADD` publication in the bucket as `APPROVED` forever — it is an
 * audit record, not live state — so the `ADD` on its own kept claiming the
 * folder was published after an administrator had approved the unpublish
 * request. That is
 * [GH #8445](https://github.com/epam/ai-dial-chat/issues/8445): the action menu
 * went on offering Unpublish for a copy Core had already deleted, and acting on
 * it failed with "Target resource does not exists". So an `APPROVED` `DELETE`
 * drops every `ADD` for the same target folder created at or before it, while
 * an `ADD` created *after* it survives — that is the publish → unpublish →
 * publish-again sequence, and comparing `createdAt` is what keeps the
 * re-publish visible. Only a removal Core labels `APPROVED` outright cancels
 * anything — a `PENDING` one changes nothing, because the copy is live until it
 * is approved, and neither does one whose status Core did not report.
 *
 * A publication that already carries `resources` is matched without a round
 * trip, so a Core (or SDK mock) that does embed them costs nothing extra.
 *
 * A failed detail lookup drops that one publication instead of failing the
 * whole call: history is informational, and one unreadable publication must not
 * take down the publish panel.
 */
export const resolvePublicationsForSource = async <T extends PublicationLike>(
  publications: T[],
  sourceUrl: string,
  fetchPublication: (url: string) => Promise<T | null>,
  logger?: Logger,
  context?: string,
): Promise<T[]> => {
  const resolved: (T | null)[] = publications.map(() => null);
  const candidates: { index: number; url: string }[] = [];

  publications.forEach((publication, index) => {
    if (publication.resources != null) {
      resolved[index] = publication;
      return;
    }
    if (!isDetailCandidate(publication.status)) {
      return;
    }
    if (!publication.url) {
      return;
    }
    candidates.push({ index, url: publication.url });
  });

  logger?.debug(
    `Resolving ${candidates.length} of ${publications.length} publication(s)${context ? ` for ${context}` : ''}`,
  );

  for (
    let start = 0;
    start < candidates.length;
    start += PUBLICATION_DETAIL_CONCURRENCY
  ) {
    const batch = candidates.slice(
      start,
      start + PUBLICATION_DETAIL_CONCURRENCY,
    );
    const details = await Promise.all(
      batch.map((candidate) => fetchPublication(candidate.url)),
    );
    details.forEach((detail, offset) => {
      if (detail != null) {
        resolved[batch[offset].index] = detail;
      }
    });
  }

  const referencing = resolved.filter(
    (publication): publication is T => publication != null,
  );

  /*
   * An undateable approved removal wins over everything in its folder
   * (`+Infinity`) and an undateable `ADD` loses to any removal (`0`): a
   * removal Core reports as approved is the more recent statement of what
   * exists, and offering Unpublish for a copy Core has deleted is the failure
   * this cancellation exists to prevent.
   */
  const removedAtByFolder = new Map<string, number>();
  for (const publication of referencing) {
    if (
      !removesSource(publication, sourceUrl) ||
      !isApprovedRemoval(publication.status)
    ) {
      continue;
    }
    const folderKey = toTargetFolderKey(publication.targetFolder);
    const removedAt = toPublicationTime(
      publication.createdAt,
      Number.POSITIVE_INFINITY,
    );
    removedAtByFolder.set(
      folderKey,
      Math.max(
        removedAtByFolder.get(folderKey) ?? Number.NEGATIVE_INFINITY,
        removedAt,
      ),
    );
  }

  if (removedAtByFolder.size > 0) {
    logger?.debug(
      `Applying ${removedAtByFolder.size} approved removal folder(s)${context ? ` for ${context}` : ''}`,
    );
  }

  return referencing.filter((publication) => {
    if (!publishesSource(publication, sourceUrl)) {
      return false;
    }
    const removedAt = removedAtByFolder.get(
      toTargetFolderKey(publication.targetFolder),
    );
    if (removedAt == null) {
      return true;
    }
    return toPublicationTime(publication.createdAt, 0) > removedAt;
  });
};

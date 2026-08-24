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
 * Whether `publication` publishes `sourceUrl`.
 *
 * A `DELETE` resource is a pending removal request submitted by an unpublish
 * endpoint, not a publication of the resource: counting it would list the
 * folder twice — once for the original `ADD`, once for the pending `DELETE` —
 * and would read as a second publish. Until an administrator approves the
 * removal the resource genuinely is still published there, so the folder stays,
 * sourced from its `ADD` publication.
 */
export const publishesSource = (
  publication: PublicationLike,
  sourceUrl: string,
): boolean =>
  publication.resources?.some(
    (resource) =>
      isSameResourceUrl(resource.sourceUrl, sourceUrl) &&
      resource.action !== PublicationResourceAction.Delete,
  ) ?? false;

/**
 * Narrows a bucket-wide publication list to the publications that publish
 * `sourceUrl`, re-fetching each candidate's full record.
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
  const matched: (T | null)[] = publications.map(() => null);
  const candidates: { index: number; url: string }[] = [];

  publications.forEach((publication, index) => {
    if (publication.resources != null) {
      matched[index] = publishesSource(publication, sourceUrl)
        ? publication
        : null;
      return;
    }
    if (
      publication.status != null &&
      publication.status !== PublicationStatus.Approved
    ) {
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
      if (detail != null && publishesSource(detail, sourceUrl)) {
        matched[batch[offset].index] = detail;
      }
    });
  }

  return matched.filter((publication): publication is T => publication != null);
};

import {
  VersionPublicationStatus,
  type VersionStatusEntryDto,
} from '@epam/ai-dial-chat-api-client';
import {
  VersionHistoryStatus,
  type VersionHistoryRow,
} from '@epam/ai-dial-publish-panel';
import { safeDecodeURIComponent } from '../shared/string-utils';
import { parseResourceFolderPath } from './resource-folder';

/** The fields of a deployments or toolsets listing item the Versions history reads. */
export interface VersionHistoryListingItem {
  /** Resource id as the listing returns it. */
  id: string;
  /** Key shared by every version of one resource saved by one owner in one folder. */
  versionGroupId?: string;
  /** Display version of the item. */
  displayVersion?: string;
  /** Last modified time, epoch milliseconds. */
  updatedAt?: number;
  /** Original author of the resource. */
  owner?: string;
  /** Whether the item belongs to the caller. */
  isMy?: boolean;
}

/** Host-supplied text and date formatting for the Versions history rows. */
export interface VersionHistoryFormatters {
  /** Translated label of the Personal root, the first part of every folder. */
  rootLabel: string;
  /** Formats a last-modified time given in epoch milliseconds. */
  formatDate: (timestamp: number) => string;
  /** Builds the author line of a published version, e.g. `Published by {name}`. */
  formatPublishedBy: (name: string) => string;
  /** Builds the author line of any other version, e.g. `by {name}`. */
  formatOwner: (name: string) => string;
  /** Builds the line that names the folders a published version is published to, e.g. `Published in {folders}`. */
  formatPublishedIn: (folders: string[]) => string;
}

const STATUS_BY_DTO: Record<VersionPublicationStatus, VersionHistoryStatus> = {
  [VersionPublicationStatus.NotPublished]: VersionHistoryStatus.NotPublished,
  [VersionPublicationStatus.InReview]: VersionHistoryStatus.InReview,
  [VersionPublicationStatus.Published]: VersionHistoryStatus.Published,
  [VersionPublicationStatus.Unknown]: VersionHistoryStatus.Unknown,
};

/**
 * Selects the other saved versions of `resourceId` from a listing: the caller's own items that share its `versionGroupId`, without the version itself.
 * @param items - deployments or toolsets listing items
 * @param resourceId - id of the resource being edited or published
 */
export const selectOtherVersions = <T extends VersionHistoryListingItem>(
  items: readonly T[],
  resourceId: string,
): T[] => {
  if (resourceId === '') return [];
  const decodedId = safeDecodeURIComponent(resourceId);
  const edited = items.find(
    (item) => safeDecodeURIComponent(item.id) === decodedId,
  );
  if (edited?.isMy !== true || edited.versionGroupId == null) return [];
  return items.filter(
    (item) =>
      item !== edited &&
      item.isMy === true &&
      item.versionGroupId === edited.versionGroupId,
  );
};

/**
 * Builds the Versions history rows, newest first by last modified time.
 * @param group - the other versions of the resource, from {@link selectOtherVersions}
 * @param statuses - statuses by item id; omit while they load
 * @param formatters - host text and date formatting
 */
export const buildVersionHistoryRows = (
  group: readonly VersionHistoryListingItem[],
  statuses: ReadonlyMap<string, VersionStatusEntryDto> | undefined,
  formatters: VersionHistoryFormatters,
): VersionHistoryRow[] => {
  return [...group]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .map((item) => {
      const entry = statuses?.get(safeDecodeURIComponent(item.id));
      const status = entry ? STATUS_BY_DTO[entry.status] : undefined;
      let author: string | undefined;
      if (status === VersionHistoryStatus.Published && entry?.publishedBy) {
        author = formatters.formatPublishedBy(entry.publishedBy);
      } else if (item.owner) {
        author = formatters.formatOwner(item.owner);
      }
      return {
        id: item.id,
        version: item.displayVersion ?? '',
        status,
        publishedIn:
          status === VersionHistoryStatus.Published &&
          entry?.publishedFolders?.length
            ? formatters.formatPublishedIn(entry.publishedFolders)
            : undefined,
        folder: [
          formatters.rootLabel,
          ...parseResourceFolderPath(item.id),
        ].join(' / '),
        modifiedAt:
          item.updatedAt != null
            ? formatters.formatDate(item.updatedAt)
            : undefined,
        author,
      };
    });
};

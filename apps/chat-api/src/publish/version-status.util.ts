import { readPublicationDisplayAuthor } from '../common/utils/user-display-name';
import { VersionPublicationStatus } from './dto/version-status-entry.dto';
import {
  narrowPublicationsForSource,
  PublicationStatus,
  publishesSource,
  type PublicationLike,
} from './publication.util';
import { stripPublicTargetFolder } from './publish-target.util';

/** The publication fields the version status reads on top of `PublicationLike`. */
export interface StatusPublication extends PublicationLike {
  author?: string;
  displayAuthor?: string;
}

/** Status of one version, before it is joined to its id and display version. */
export interface ResolvedVersionStatus {
  status: VersionPublicationStatus;
  publishedFolders: string[];
  publishedBy?: string;
}

const toTime = (publication: PublicationLike): number => {
  const time = new Date(publication.createdAt ?? 0).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/**
 * The status of the version stored at `sourceUrl`, from the caller's own
 * resolved publications: Published when a live approved publication exists
 * (with its folders and the newest publisher), otherwise In review when a
 * pending request publishes it, otherwise Not published. Published wins over
 * In review; rejected publications and approved removals count as nothing.
 * @param publications - every resolved publication of the caller's bucket
 * @param sourceUrl - resource id of the version
 */
export const resolveVersionStatus = (
  publications: StatusPublication[],
  sourceUrl: string,
): ResolvedVersionStatus => {
  const live = narrowPublicationsForSource(
    publications.filter(
      (publication) =>
        publication.status !== PublicationStatus.Pending &&
        publication.status !== PublicationStatus.Rejected,
    ),
    sourceUrl,
  ).sort((a, b) => toTime(b) - toTime(a));

  if (live.length > 0) {
    const publishedFolders = [
      ...new Set(
        live.map((publication) =>
          stripPublicTargetFolder(publication.targetFolder ?? ''),
        ),
      ),
    ];
    return {
      status: VersionPublicationStatus.Published,
      publishedFolders,
      publishedBy: readPublicationDisplayAuthor(live[0], '') || undefined,
    };
  }

  const isInReview = publications.some(
    (publication) =>
      publication.status === PublicationStatus.Pending &&
      publishesSource(publication, sourceUrl),
  );
  return {
    status: isInReview
      ? VersionPublicationStatus.InReview
      : VersionPublicationStatus.NotPublished,
    publishedFolders: [],
  };
};

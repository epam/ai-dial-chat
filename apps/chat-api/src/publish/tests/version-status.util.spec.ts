import { describe, expect, it } from 'vitest';
import { VersionPublicationStatus } from '../dto/version-status-entry.dto';
import {
  PublicationResourceAction,
  PublicationStatus,
} from '../publication.util';
import {
  resolveVersionStatus,
  type StatusPublication,
} from '../version-status.util';

const SOURCE = 'applications/bucket-123/Design/Review__1.0.0';
const TARGET = 'applications/public/Organization/Review__1.0.0';

const publication = (
  status: PublicationStatus | undefined,
  overrides: Partial<StatusPublication> & { action?: string } = {},
): StatusPublication => {
  const { action = PublicationResourceAction.Add, ...rest } = overrides;
  return {
    url: 'publications/bucket-123/1',
    ...(status ? { status } : {}),
    targetFolder: 'public/Organization/',
    createdAt: 1000,
    author: 'jane@example.com',
    displayAuthor: 'Jane Doe',
    resources: [{ action, sourceUrl: SOURCE, targetUrl: TARGET }],
    ...rest,
  };
};

describe('resolveVersionStatus', () => {
  it('is Not published without any publication', () => {
    expect(resolveVersionStatus([], SOURCE)).toEqual({
      status: VersionPublicationStatus.NotPublished,
      publishedFolders: [],
    });
  });

  it('is In review for a Pending publication', () => {
    expect(
      resolveVersionStatus([publication(PublicationStatus.Pending)], SOURCE),
    ).toEqual({
      status: VersionPublicationStatus.InReview,
      publishedFolders: [],
    });
  });

  it('is Published for an Approved publication, with its folder and publisher', () => {
    expect(
      resolveVersionStatus([publication(PublicationStatus.Approved)], SOURCE),
    ).toEqual({
      status: VersionPublicationStatus.Published,
      publishedFolders: ['Organization'],
      publishedBy: 'Jane Doe',
    });
  });

  it('treats a publication without a status as approved', () => {
    expect(resolveVersionStatus([publication(undefined)], SOURCE).status).toBe(
      VersionPublicationStatus.Published,
    );
  });

  it('treats ADD_IF_ABSENT like ADD', () => {
    expect(
      resolveVersionStatus(
        [
          publication(PublicationStatus.Approved, {
            action: PublicationResourceAction.AddIfAbsent,
          }),
        ],
        SOURCE,
      ).status,
    ).toBe(VersionPublicationStatus.Published);
    expect(
      resolveVersionStatus(
        [
          publication(PublicationStatus.Pending, {
            action: PublicationResourceAction.AddIfAbsent,
          }),
        ],
        SOURCE,
      ).status,
    ).toBe(VersionPublicationStatus.InReview);
  });

  it('is Not published for a Rejected publication', () => {
    expect(
      resolveVersionStatus([publication(PublicationStatus.Rejected)], SOURCE)
        .status,
    ).toBe(VersionPublicationStatus.NotPublished);
  });

  it('lets Published win over In review', () => {
    expect(
      resolveVersionStatus(
        [
          publication(PublicationStatus.Pending, { createdAt: 2000 }),
          publication(PublicationStatus.Approved),
        ],
        SOURCE,
      ).status,
    ).toBe(VersionPublicationStatus.Published);
  });

  it('is Not published after an approved removal of the published copy', () => {
    expect(
      resolveVersionStatus(
        [
          publication(PublicationStatus.Approved),
          publication(PublicationStatus.Approved, {
            url: 'publications/bucket-123/2',
            createdAt: 2000,
            action: PublicationResourceAction.Delete,
          }),
        ],
        SOURCE,
      ).status,
    ).toBe(VersionPublicationStatus.NotPublished);
  });

  it('stays Published while a removal is only Pending', () => {
    expect(
      resolveVersionStatus(
        [
          publication(PublicationStatus.Approved),
          publication(PublicationStatus.Pending, {
            url: 'publications/bucket-123/2',
            createdAt: 2000,
            action: PublicationResourceAction.Delete,
          }),
        ],
        SOURCE,
      ).status,
    ).toBe(VersionPublicationStatus.Published);
  });

  it('lists every folder once and takes the publisher of the newest publication', () => {
    expect(
      resolveVersionStatus(
        [
          publication(PublicationStatus.Approved, { createdAt: 1000 }),
          publication(PublicationStatus.Approved, {
            url: 'publications/bucket-123/2',
            createdAt: 3000,
            targetFolder: 'public/Organization/Team/',
            displayAuthor: 'John Roe',
          }),
          publication(PublicationStatus.Approved, {
            url: 'publications/bucket-123/3',
            createdAt: 2000,
            targetFolder: 'public/Organization/',
          }),
        ],
        SOURCE,
      ),
    ).toEqual({
      status: VersionPublicationStatus.Published,
      publishedFolders: ['Organization/Team', 'Organization'],
      publishedBy: 'John Roe',
    });
  });

  it('ignores a publication of another version', () => {
    expect(
      resolveVersionStatus(
        [publication(PublicationStatus.Approved)],
        'applications/bucket-123/Design/Review__2.0.0',
      ).status,
    ).toBe(VersionPublicationStatus.NotPublished);
  });
});

import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  getPublicationSourceAction,
  PublicationResourceAction,
  PublicationStatus,
  publishesSource,
  removesSource,
  resolvePublicationsForSource,
  toPublicationList,
} from '../publication.util';

interface TestPublication {
  targetFolder: string;
}

const publication = (targetFolder: string): TestPublication => ({
  targetFolder,
});

describe('toPublicationList', () => {
  it('returns a bare array unchanged, the shape the SDK types', () => {
    const data = [publication('public/A/'), publication('public/B/')];

    expect(toPublicationList<TestPublication>(data)).toEqual(data);
  });

  /*
   * The regression this helper exists for: a live Core answers with an
   * envelope, and calling `.filter` on it threw a `TypeError` that surfaced as
   * a 503 "DIAL Core is currently unavailable" (GH #7897).
   */
  it('unwraps the { publications: [...] } envelope a live Core returns', () => {
    const publications = [publication('public/A/')];

    expect(toPublicationList<TestPublication>({ publications })).toEqual(
      publications,
    );
  });

  it('treats a missing response as an empty list without warning', () => {
    const logger = { warn: vi.fn() } as unknown as Logger;

    expect(toPublicationList<TestPublication>(undefined, logger)).toEqual([]);
    expect(toPublicationList<TestPublication>(null, logger)).toEqual([]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('degrades an unrecognised shape to an empty list and warns', () => {
    const logger = { warn: vi.fn() } as unknown as Logger;

    expect(
      toPublicationList<TestPublication>({ unexpected: true }, logger, 'ctx'),
    ).toEqual([]);
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it('does not throw on any input shape, so history never breaks the panel', () => {
    for (const input of ['a string', 42, true, {}, { publications: null }]) {
      expect(() => toPublicationList<TestPublication>(input)).not.toThrow();
      expect(toPublicationList<TestPublication>(input)).toEqual([]);
    }
  });
});

interface ListedPublication {
  url?: string;
  status?: string;
  targetFolder?: string;
  createdAt?: number | string;
  resources?: { action?: string; sourceUrl?: string }[];
}

const SOURCE_URL = 'applications/bucket-123/my-app__1.0.0';

const listed = (
  url: string,
  status = PublicationStatus.Approved,
): ListedPublication => ({ url, status, targetFolder: 'public/folder/' });

const detailed = (
  url: string,
  sourceUrl: string,
  action = PublicationResourceAction.Add,
): ListedPublication => ({
  ...listed(url),
  resources: [{ action, sourceUrl }],
});

describe('publishesSource', () => {
  it('matches an ADD resource for the source url', () => {
    expect(
      publishesSource(detailed('publications/b/1', SOURCE_URL), SOURCE_URL),
    ).toBe(true);
  });

  /*
   * A pending DELETE is a removal *request*: until an admin approves it the
   * resource is still published, and counting the DELETE would list the same
   * folder a second time.
   */
  it('does not match a DELETE resource', () => {
    expect(
      publishesSource(
        detailed(
          'publications/b/1',
          SOURCE_URL,
          PublicationResourceAction.Delete,
        ),
        SOURCE_URL,
      ),
    ).toBe(false);
  });

  it('matches across a percent-encoding difference', () => {
    expect(
      publishesSource(
        detailed('publications/b/1', 'applications/b/My%20App__1.0.0'),
        'applications/b/My App__1.0.0',
      ),
    ).toBe(true);
  });

  it('does not match a different resource', () => {
    expect(
      publishesSource(
        detailed('publications/b/1', 'applications/bucket-123/other__1.0.0'),
        SOURCE_URL,
      ),
    ).toBe(false);
  });

  it('does not match a publication with no resources', () => {
    expect(publishesSource(listed('publications/b/1'), SOURCE_URL)).toBe(false);
  });
});

describe('getPublicationSourceAction', () => {
  it('returns null when the publication does not reference the source', () => {
    expect(
      getPublicationSourceAction(listed('publications/b/1'), SOURCE_URL),
    ).toBeNull();
  });

  it('reports ADD and DELETE for the referenced source', () => {
    expect(
      getPublicationSourceAction(
        detailed('publications/b/1', SOURCE_URL),
        SOURCE_URL,
      ),
    ).toBe(PublicationResourceAction.Add);
    expect(
      getPublicationSourceAction(
        detailed(
          'publications/b/1',
          SOURCE_URL,
          PublicationResourceAction.Delete,
        ),
        SOURCE_URL,
      ),
    ).toBe(PublicationResourceAction.Delete);
  });

  /* Core's own default, so a resource that omits `action` is publishing. */
  it('treats a resource with no action as ADD', () => {
    expect(
      getPublicationSourceAction(
        {
          ...listed('publications/b/1'),
          resources: [{ sourceUrl: SOURCE_URL }],
        },
        SOURCE_URL,
      ),
    ).toBe(PublicationResourceAction.Add);
  });

  it('reports ADD_IF_ABSENT as itself, and as publishing', () => {
    const publication = detailed(
      'publications/b/1',
      SOURCE_URL,
      PublicationResourceAction.AddIfAbsent,
    );

    expect(getPublicationSourceAction(publication, SOURCE_URL)).toBe(
      PublicationResourceAction.AddIfAbsent,
    );
    expect(publishesSource(publication, SOURCE_URL)).toBe(true);
    expect(removesSource(publication, SOURCE_URL)).toBe(false);
  });
});

describe('removesSource', () => {
  it('matches only a DELETE resource for the source url', () => {
    expect(
      removesSource(
        detailed(
          'publications/b/1',
          SOURCE_URL,
          PublicationResourceAction.Delete,
        ),
        SOURCE_URL,
      ),
    ).toBe(true);
    expect(
      removesSource(detailed('publications/b/1', SOURCE_URL), SOURCE_URL),
    ).toBe(false);
    expect(removesSource(listed('publications/b/1'), SOURCE_URL)).toBe(false);
  });

  /* Whether the removal has happened is `status`, not the action. */
  it('matches a DELETE regardless of status', () => {
    expect(
      removesSource(
        {
          ...listed('publications/b/1', PublicationStatus.Pending),
          resources: [
            {
              action: PublicationResourceAction.Delete,
              sourceUrl: SOURCE_URL,
            },
          ],
        },
        SOURCE_URL,
      ),
    ).toBe(true);
  });
});

describe('resolvePublicationsForSource', () => {
  /*
   * The regression this helper exists for: DIAL Core's `getPublications`
   * returns publication metadata only — no `resources` — so filtering the list
   * response by `resources[].sourceUrl` matched nothing. A live Core returned
   * 60 publications and publish history still came back empty, which hid
   * Unpublish on an entity that was demonstrably published.
   */
  it('re-fetches each candidate, because the list carries no resources', async () => {
    const fetchPublication = vi.fn(async (url: string) =>
      url === 'publications/b/2'
        ? detailed(url, SOURCE_URL)
        : detailed(url, 'applications/bucket-123/other__1.0.0'),
    );

    const matched = await resolvePublicationsForSource(
      [listed('publications/b/1'), listed('publications/b/2')],
      SOURCE_URL,
      fetchPublication,
    );

    expect(fetchPublication).toHaveBeenCalledTimes(2);
    expect(matched).toEqual([detailed('publications/b/2', SOURCE_URL)]);
  });

  it('keeps the detailed record, so targetFolder comes from the full publication', async () => {
    const detail = {
      ...detailed('publications/b/1', SOURCE_URL),
      targetFolder: 'public/Reports/',
    };

    const [match] = await resolvePublicationsForSource(
      [listed('publications/b/1')],
      SOURCE_URL,
      async () => detail,
    );

    expect(match.targetFolder).toBe('public/Reports/');
  });

  /* Only an APPROVED publication describes a folder the resource is published to. */
  it('never fetches a PENDING or REJECTED publication', async () => {
    const fetchPublication = vi.fn(async (url: string) =>
      detailed(url, SOURCE_URL),
    );

    const matched = await resolvePublicationsForSource(
      [
        listed('publications/b/1', PublicationStatus.Pending),
        listed('publications/b/2', PublicationStatus.Rejected),
      ],
      SOURCE_URL,
      fetchPublication,
    );

    expect(fetchPublication).not.toHaveBeenCalled();
    expect(matched).toEqual([]);
  });

  it('matches an embedded resources array without a round trip', async () => {
    const fetchPublication = vi.fn(async (url: string) =>
      detailed(url, SOURCE_URL),
    );

    const matched = await resolvePublicationsForSource(
      [detailed('publications/b/1', SOURCE_URL)],
      SOURCE_URL,
      fetchPublication,
    );

    expect(fetchPublication).not.toHaveBeenCalled();
    expect(matched).toHaveLength(1);
  });

  it('drops a publication whose detail lookup fails instead of throwing', async () => {
    const matched = await resolvePublicationsForSource(
      [listed('publications/b/1'), listed('publications/b/2')],
      SOURCE_URL,
      async (url) =>
        url === 'publications/b/1' ? null : detailed(url, SOURCE_URL),
    );

    expect(matched).toEqual([detailed('publications/b/2', SOURCE_URL)]);
  });

  it('skips a publication Core listed without a url', async () => {
    const fetchPublication = vi.fn(async (url: string) =>
      detailed(url, SOURCE_URL),
    );

    const matched = await resolvePublicationsForSource(
      [{ status: PublicationStatus.Approved }],
      SOURCE_URL,
      fetchPublication,
    );

    expect(fetchPublication).not.toHaveBeenCalled();
    expect(matched).toEqual([]);
  });

  it('resolves a bucket-sized list, batching the lookups', async () => {
    const publications = Array.from({ length: 60 }, (_, index) =>
      listed(`publications/b/${index}`),
    );
    let inFlight = 0;
    let peakInFlight = 0;
    const fetchPublication = async (url: string) => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return url === 'publications/b/42'
        ? detailed(url, SOURCE_URL)
        : detailed(url, 'applications/bucket-123/other__1.0.0');
    };

    const matched = await resolvePublicationsForSource(
      publications,
      SOURCE_URL,
      fetchPublication,
    );

    expect(matched).toEqual([detailed('publications/b/42', SOURCE_URL)]);
    expect(peakInFlight).toBeLessThanOrEqual(8);
  });
});

const FOLDER = 'public/folder/';

/** An `APPROVED` publication carrying one resource for `SOURCE_URL`. */
const approved = (
  url: string,
  action: PublicationResourceAction,
  createdAt: number | string | undefined,
  targetFolder = FOLDER,
): ListedPublication => ({
  url,
  status: PublicationStatus.Approved,
  targetFolder,
  createdAt,
  resources: [{ action, sourceUrl: SOURCE_URL }],
});

/*
 * GH #8445. Core never retracts the original `ADD` publication — it stays
 * `APPROVED` as an audit record — so once an administrator approved an
 * unpublish request the folder still looked published, the action menu went on
 * offering Unpublish, and acting on it failed with "Target resource does not
 * exists".
 */
describe('resolvePublicationsForSource, approved removals', () => {
  const resolve = (publications: ListedPublication[]) =>
    resolvePublicationsForSource(
      publications,
      SOURCE_URL,
      async () => null,
      undefined,
      'ctx',
    );

  it('drops the ADD once its removal is APPROVED', async () => {
    expect(
      await resolve([
        approved('publications/b/1', PublicationResourceAction.Add, 1000),
        approved('publications/b/2', PublicationResourceAction.Delete, 2000),
      ]),
    ).toEqual([]);
  });

  /* Until an admin approves, the published copy is still live. */
  it('keeps the ADD while the removal is only PENDING', async () => {
    const add = approved(
      'publications/b/1',
      PublicationResourceAction.Add,
      1000,
    );

    expect(
      await resolve([
        add,
        {
          ...approved(
            'publications/b/2',
            PublicationResourceAction.Delete,
            2000,
          ),
          status: PublicationStatus.Pending,
        },
      ]),
    ).toEqual([add]);
  });

  /*
   * Cancelling on an assumed approval is the more expensive mistake: it hides
   * Unpublish for a copy that is still live and offers a Publish that Core
   * rejects because the target already exists.
   */
  it('keeps the ADD when Core reported no status on the removal', async () => {
    const add = approved(
      'publications/b/1',
      PublicationResourceAction.Add,
      1000,
    );
    const removal = approved(
      'publications/b/2',
      PublicationResourceAction.Delete,
      2000,
    );
    delete removal.status;

    expect(await resolve([add, removal])).toEqual([add]);
  });

  it('keeps the ADD when the removal was REJECTED', async () => {
    const add = approved(
      'publications/b/1',
      PublicationResourceAction.Add,
      1000,
    );

    expect(
      await resolve([
        add,
        {
          ...approved(
            'publications/b/2',
            PublicationResourceAction.Delete,
            2000,
          ),
          status: PublicationStatus.Rejected,
        },
      ]),
    ).toEqual([add]);
  });

  /* publish → unpublish (approved) → publish again: the folder is published. */
  it('keeps an ADD created after the approved removal', async () => {
    const republished = approved(
      'publications/b/3',
      PublicationResourceAction.Add,
      3000,
    );

    expect(
      await resolve([
        approved('publications/b/1', PublicationResourceAction.Add, 1000),
        approved('publications/b/2', PublicationResourceAction.Delete, 2000),
        republished,
      ]),
    ).toEqual([republished]);
  });

  it('cancels only the folder the removal targeted', async () => {
    const otherFolder = approved(
      'publications/b/3',
      PublicationResourceAction.Add,
      1000,
      'public/reports/',
    );

    expect(
      await resolve([
        approved('publications/b/1', PublicationResourceAction.Add, 1000),
        approved('publications/b/2', PublicationResourceAction.Delete, 2000),
        otherFolder,
      ]),
    ).toEqual([otherFolder]);
  });

  /* Core echoes `targetFolder` percent-encoded; the ADD was built from plain text. */
  it('matches the removal across a percent-encoding difference', async () => {
    expect(
      await resolve([
        approved(
          'publications/b/1',
          PublicationResourceAction.Add,
          1000,
          'public/New Folder/',
        ),
        approved(
          'publications/b/2',
          PublicationResourceAction.Delete,
          2000,
          'public/New%20Folder/',
        ),
      ]),
    ).toEqual([]);
  });

  it('accepts an ISO createdAt as well as epoch milliseconds', async () => {
    expect(
      await resolve([
        approved(
          'publications/b/1',
          PublicationResourceAction.Add,
          '2026-08-01T00:00:00.000Z',
        ),
        approved(
          'publications/b/2',
          PublicationResourceAction.Delete,
          '2026-08-02T00:00:00.000Z',
        ),
      ]),
    ).toEqual([]);
  });

  /*
   * An approved removal that cannot be dated is the more recent statement of
   * what exists: showing Unpublish for a copy Core has deleted is the failure
   * being prevented.
   */
  it('lets an undateable approved removal cancel its folder', async () => {
    expect(
      await resolve([
        approved('publications/b/1', PublicationResourceAction.Add, 1000),
        approved(
          'publications/b/2',
          PublicationResourceAction.Delete,
          undefined,
        ),
      ]),
    ).toEqual([]);
  });

  /*
   * The trade-off the `+Infinity` fallback makes on purpose: with no date on
   * the removal there is nothing to order it against, so it cancels the whole
   * folder — a later re-publish included. Pinned because the alternative
   * (letting the dateable ADD win) would offer Unpublish for a copy Core may
   * already have deleted, the failure GH #8445 is about.
   */
  it('cancels a later ADD when the approved removal cannot be dated', async () => {
    expect(
      await resolve([
        approved('publications/b/1', PublicationResourceAction.Add, 1000),
        approved(
          'publications/b/2',
          PublicationResourceAction.Delete,
          undefined,
        ),
        approved('publications/b/3', PublicationResourceAction.Add, 3000),
      ]),
    ).toEqual([]);
  });

  it('warns instead of silently cancelling when a removal cannot be dated', async () => {
    const logger = { debug: vi.fn(), warn: vi.fn() };

    await resolvePublicationsForSource(
      [
        approved('publications/b/1', PublicationResourceAction.Add, 1000),
        approved(
          'publications/b/2',
          PublicationResourceAction.Delete,
          undefined,
        ),
      ],
      SOURCE_URL,
      async () => null,
      logger as never,
      'ctx',
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no usable createdAt'),
    );
  });

  it('never reports the removal publication itself as published', async () => {
    expect(
      await resolve([
        approved('publications/b/2', PublicationResourceAction.Delete, 2000),
      ]),
    ).toEqual([]);
  });

  /* The real path: the list carries metadata only, details come from lookups. */
  it('cancels across separately fetched detail records', async () => {
    const details: Record<string, ListedPublication> = {
      'publications/b/1': approved(
        'publications/b/1',
        PublicationResourceAction.Add,
        1000,
      ),
      'publications/b/2': approved(
        'publications/b/2',
        PublicationResourceAction.Delete,
        2000,
      ),
    };
    const fetchPublication = vi.fn(async (url: string) => details[url] ?? null);

    const matched = await resolvePublicationsForSource(
      [listed('publications/b/1'), listed('publications/b/2')],
      SOURCE_URL,
      fetchPublication,
    );

    expect(fetchPublication).toHaveBeenCalledTimes(2);
    expect(matched).toEqual([]);
  });
});

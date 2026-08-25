import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  PublicationResourceAction,
  PublicationStatus,
  publishesSource,
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

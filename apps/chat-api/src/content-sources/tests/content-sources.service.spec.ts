import {
  BadRequestException,
  NotFoundException,
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createCache } from 'cache-manager';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ContentProvider,
  ProviderContext,
  UpstreamError,
  UpstreamFailure,
} from '../content-provider';
import {
  ContentSourcesAdmissionService,
  ContentSourcesMissLimitException,
} from '../content-sources-admission.service';
import {
  ContentSourcesCacheService,
  ContentSourcesCaches,
} from '../content-sources-cache.service';
import {
  ContentSource,
  ContentSourceDateMode,
  ContentSourceKind,
  ContentSourceProvider,
  ContentSourceSort,
  ContentSourcesRegistryService,
} from '../content-sources-registry.service';
import { contentSourcesStaleServed } from '../content-sources-telemetry';
import { createContentSourcesCaches } from '../content-sources.module';
import {
  ContentSourcesQueueFullException,
  ContentSourcesRequest,
  ContentSourcesService,
} from '../content-sources.service';
import { GitHubProvider } from '../providers/github.provider';
import { GitLabProvider } from '../providers/gitlab.provider';

const MISS_LIMIT = 8;
const REQUEST: ContentSourcesRequest = { principalKey: 'keycloak:user-1' };

const base: ContentSource = {
  id: 'rn',
  title: 'Release notes',
  provider: ContentSourceProvider.GitHub,
  baseUrl: 'https://api.github.com',
  repository: 'epam/ai-dial',
  ref: 'main',
  kind: ContentSourceKind.Directory,
  path: 'docs/releases',
  include: '**/*.md',
  assetsPath: 'docs',
  sort: ContentSourceSort.NameDesc,
  date: ContentSourceDateMode.None,
  feed: { summaryHeading: 'Summary' },
};

const build = (
  source: ContentSource,
  provider: Partial<ContentProvider> = {},
  caches: ContentSourcesCaches = {
    meta: createCache(),
    content: createCache(),
  } as unknown as ContentSourcesCaches,
) => {
  const defaults = {
    listDocuments: vi.fn().mockResolvedValue({ files: [], truncated: false }),
    readFile: vi.fn().mockResolvedValue(Buffer.from('# T')),
    fileDate: vi.fn().mockResolvedValue(null),
    webUrl: vi.fn().mockReturnValue('https://github.com/x'),
  };
  /* `provider` overrides are plain functions or mocks; callers read mocks off the defaults' shape. */
  const github = { ...defaults, ...provider } as typeof defaults;
  const registry = {
    get: (id: string) => (id === source.id ? source : undefined),
    cacheTtlMs: 60_000,
    timeoutMs: 1000,
    principalMissConcurrency: MISS_LIMIT,
  } as unknown as ContentSourcesRegistryService;
  const admission = new ContentSourcesAdmissionService(registry);
  const service = new ContentSourcesService(
    registry,
    new ContentSourcesCacheService(caches, registry),
    admission,
    github as unknown as GitHubProvider,
    {} as GitLabProvider,
  );
  return { service, github, admission };
};

const files = (...names: string[]) => ({
  files: names.map((name) => `docs/releases/${name}`),
  truncated: false,
});

describe('ContentSourcesService', () => {
  it('404s an unknown source', async () => {
    const { service } = build(base);
    await expect(service.listSource('nope', REQUEST)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('listSource', () => {
    it('filters by include, sorts numeric-aware and titles from the first H1', async () => {
      const readFile = vi.fn(async (_s, path: string) =>
        Buffer.from(path.endsWith('10.0.md') ? '# Ten' : 'no heading'),
      );
      const { service } = build(base, {
        listDocuments: vi
          .fn()
          .mockResolvedValue(
            files('2.0.md', '10.0.md', '9.0.md', 'img/a.png', 'notes.txt'),
          ),
        readFile,
      });
      const listing = await service.listSource('rn', REQUEST);
      expect(listing.documents.map((d) => d.path)).toEqual([
        'docs/releases/10.0.md',
        'docs/releases/9.0.md',
        'docs/releases/2.0.md',
      ]);
      expect(listing.documents[0]).toEqual({
        path: 'docs/releases/10.0.md',
        title: 'Ten',
        date: null,
      });
      expect(listing.documents[1].title).toBe('9.0');
      expect(listing).toMatchObject({
        id: 'rn',
        title: 'Release notes',
        kind: 'directory',
        feed: { summaryHeading: 'Summary' },
        webUrl: 'https://github.com/x',
      });
    });

    it('sorts name-asc', async () => {
      const { service } = build(
        { ...base, sort: ContentSourceSort.NameAsc },
        {
          listDocuments: vi
            .fn()
            .mockResolvedValue(files('2.md', '10.md', '1.md')),
        },
      );
      expect(
        (await service.listSource('rn', REQUEST)).documents.map((d) => d.path),
      ).toEqual([
        'docs/releases/1.md',
        'docs/releases/2.md',
        'docs/releases/10.md',
      ]);
    });

    it('sorts date-desc with undated documents last and fetches dates', async () => {
      const dates: Record<string, string | null> = {
        'docs/releases/a.md': '2024-01-01T00:00:00.000Z',
        'docs/releases/b.md': null,
        'docs/releases/c.md': '2025-01-01T00:00:00.000Z',
      };
      const fileDate = vi.fn(async (_s, path: string) =>
        dates[path] ? new Date(dates[path] as string) : null,
      );
      const { service } = build(
        {
          ...base,
          sort: ContentSourceSort.DateDesc,
          date: ContentSourceDateMode.Created,
        },
        {
          listDocuments: vi
            .fn()
            .mockResolvedValue(files('a.md', 'b.md', 'c.md')),
          fileDate,
        },
      );
      const listing = await service.listSource('rn', REQUEST);
      expect(listing.documents.map((d) => d.path)).toEqual([
        'docs/releases/c.md',
        'docs/releases/a.md',
        'docs/releases/b.md',
      ]);
      expect(listing.documents[0].date).toBe('2025-01-01T00:00:00.000Z');
      expect(listing.documents[2].date).toBeNull();
    });

    it('never fetches dates when date is none', async () => {
      const { service, github } = build(base, {
        listDocuments: vi.fn().mockResolvedValue(files('a.md')),
      });
      await service.listSource('rn', REQUEST);
      expect(github.fileDate).not.toHaveBeenCalled();
    });

    it('limits upstream date calls to 4 at a time', async () => {
      let active = 0;
      let peak = 0;
      const fileDate = vi.fn(async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 3));
        active -= 1;
        return new Date('2024-01-01T00:00:00Z');
      });
      const { service } = build(
        { ...base, date: ContentSourceDateMode.Updated },
        {
          listDocuments: vi
            .fn()
            .mockResolvedValue(
              files(...Array.from({ length: 20 }, (_, i) => `${i}.md`)),
            ),
          fileDate,
        },
      );
      await service.listSource('rn', REQUEST);
      expect(fileDate).toHaveBeenCalledTimes(20);
      expect(peak).toBeLessThanOrEqual(4);
    });

    it('caps a source at 200 documents', async () => {
      const { service } = build(base, {
        listDocuments: vi
          .fn()
          .mockResolvedValue(
            files(...Array.from({ length: 250 }, (_, i) => `${i}.md`)),
          ),
      });
      expect((await service.listSource('rn', REQUEST)).documents).toHaveLength(
        200,
      );
    });

    it('lists a file source as one document', async () => {
      const { service } = build({
        ...base,
        kind: ContentSourceKind.File,
        path: 'docs/guide.md',
      });
      const listing = await service.listSource('rn', REQUEST);
      expect(listing.documents.map((d) => d.path)).toEqual(['docs/guide.md']);
    });

    it('falls back to the file name when one document cannot be read', async () => {
      const { service } = build(base, {
        listDocuments: vi.fn().mockResolvedValue(files('a.md')),
        readFile: vi
          .fn()
          .mockRejectedValue(
            new UpstreamError(UpstreamFailure.TooLarge, 'big'),
          ),
      });
      expect((await service.listSource('rn', REQUEST)).documents[0].title).toBe(
        'a',
      );
    });

    it('fails the listing on a credential problem', async () => {
      const { service } = build(base, {
        listDocuments: vi
          .fn()
          .mockRejectedValue(
            new UpstreamError(UpstreamFailure.Credentials, 'no'),
          ),
      });
      await expect(service.listSource('rn', REQUEST)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('caches the assembled listing', async () => {
      const listDocuments = vi.fn().mockResolvedValue(files('a.md'));
      const { service } = build(base, { listDocuments });
      await service.listSource('rn', REQUEST);
      await service.listSource('rn', REQUEST);
      expect(listDocuments).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDocument', () => {
    it('returns the markdown unchanged with title, date and webUrl', async () => {
      const markdown = '# Hello\n\n![x](../img/a.png) [l](./b.md)\n';
      const { service, github } = build(
        { ...base, date: ContentSourceDateMode.Updated },
        {
          readFile: vi.fn().mockResolvedValue(Buffer.from(markdown)),
          fileDate: vi.fn().mockResolvedValue(new Date('2025-02-02T00:00:00Z')),
        },
      );
      const doc = await service.getDocument(
        'rn',
        'docs/releases/./1.0.md',
        REQUEST,
      );
      expect(doc).toEqual({
        path: 'docs/releases/1.0.md',
        title: 'Hello',
        date: '2025-02-02T00:00:00.000Z',
        markdown,
        webUrl: 'https://github.com/x',
      });
      expect(github.readFile.mock.calls[0][1]).toBe('docs/releases/1.0.md');
    });

    it.each(['../x.md', '/abs.md', 'a\\b.md'])(
      '400s the path %p without an upstream call',
      async (path) => {
        const { service, github } = build(base);
        await expect(
          service.getDocument('rn', path, REQUEST),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(github.readFile).not.toHaveBeenCalled();
      },
    );

    it.each([
      'docs/other/a.md',
      'docs/releases/a.txt',
      'docs/releases',
      'docs/releases-x/a.md',
    ])('404s %p outside the root or include', async (path) => {
      const { service, github } = build(base);
      await expect(
        service.getDocument('rn', path, REQUEST),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(github.readFile).not.toHaveBeenCalled();
    });

    it('only serves the configured path of a file source', async () => {
      const { service } = build({
        ...base,
        kind: ContentSourceKind.File,
        path: 'docs/guide.md',
      });
      await expect(
        service.getDocument('rn', 'docs/other.md', REQUEST),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getDocument('rn', 'docs/guide.md', REQUEST),
      ).resolves.toBeDefined();
    });

    it.each([
      [UpstreamFailure.NotFound, NotFoundException],
      [UpstreamFailure.Credentials, BadGatewayException],
      [UpstreamFailure.TooLarge, BadGatewayException],
      [UpstreamFailure.Unavailable, ServiceUnavailableException],
      [UpstreamFailure.BadResponse, BadGatewayException],
    ])('maps %s', async (failure, expected) => {
      const { service } = build(base, {
        readFile: vi.fn().mockRejectedValue(new UpstreamError(failure, 'x')),
      });
      await expect(
        service.getDocument('rn', 'docs/releases/a.md', REQUEST),
      ).rejects.toBeInstanceOf(expected);
    });
  });

  describe('getAsset', () => {
    it.each([
      ['docs/img/a.png', 'image/png'],
      ['docs/a.JPG', 'image/jpeg'],
      ['docs/a.svg', 'image/svg+xml'],
      ['docs/a.webp', 'image/webp'],
    ])('serves %s as %s', async (path, contentType) => {
      const { service } = build(base, {
        readFile: vi.fn().mockResolvedValue(Buffer.from('bytes')),
      });
      expect((await service.getAsset('rn', path, REQUEST)).contentType).toBe(
        contentType,
      );
    });

    it('400s a disallowed extension', async () => {
      const { service, github } = build(base);
      await expect(
        service.getAsset('rn', 'docs/a.html', REQUEST),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.getAsset('rn', 'docs/noext', REQUEST),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(github.readFile).not.toHaveBeenCalled();
    });

    it('404s outside assetsPath, and normalizes ../ spellings first', async () => {
      const { service, github } = build(base);
      await expect(
        service.getAsset('rn', 'secret/a.png', REQUEST),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getAsset('rn', 'docs/releases/../../secret/a.png', REQUEST),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getAsset('rn', 'docs/releases/../img/a.png', REQUEST),
      ).resolves.toBeDefined();
      expect(github.readFile.mock.calls[0][1]).toBe('docs/img/a.png');
    });

    it('does not cache an asset above 512 KiB', async () => {
      const readFile = vi.fn().mockResolvedValue(Buffer.alloc(512 * 1024 + 1));
      const { service } = build(base, { readFile });
      await service.getAsset('rn', 'docs/big.png', REQUEST);
      await service.getAsset('rn', 'docs/big.png', REQUEST);
      expect(readFile).toHaveBeenCalledTimes(2);
    });

    it('caches a small asset', async () => {
      const readFile = vi.fn().mockResolvedValue(Buffer.from('small'));
      const { service } = build(base, { readFile });
      await service.getAsset('rn', 'docs/s.png', REQUEST);
      await service.getAsset('rn', 'docs/./s.png', REQUEST);
      expect(readFile).toHaveBeenCalledTimes(1);
    });
  });
  describe('regressions found in review', () => {
    it('serves a listed file name containing a percent sign', async () => {
      const readFile = vi.fn().mockResolvedValue(Buffer.from('# Pct'));
      const { service } = build(base, {
        listDocuments: vi.fn().mockResolvedValue(files('100%.md', 'a%20b.md')),
        readFile,
      });
      const listing = await service.listSource('rn', REQUEST);
      for (const { path } of listing.documents) {
        await expect(
          service.getDocument('rn', path, REQUEST),
        ).resolves.toMatchObject({
          path,
        });
      }
      expect(readFile.mock.calls.map((call) => call[1]).sort()).toEqual(
        expect.arrayContaining([
          'docs/releases/100%.md',
          'docs/releases/a%20b.md',
        ]),
      );
    });

    it('keeps the listing and every date cached for a maximum-size source', async () => {
      const names = Array.from({ length: 200 }, (_, i) => `${i}.md`);
      const fileDate = vi.fn().mockResolvedValue(new Date('2025-01-01'));
      const { service } = build(
        {
          ...base,
          sort: ContentSourceSort.DateDesc,
          date: ContentSourceDateMode.Updated,
        },
        { listDocuments: vi.fn().mockResolvedValue(files(...names)), fileDate },
        createContentSourcesCaches(),
      );
      await service.listSource('rn', REQUEST);
      const datesAfterListing = fileDate.mock.calls.length;
      expect(datesAfterListing).toBe(200);

      for (const name of names) {
        await service.getDocument('rn', `docs/releases/${name}`, REQUEST);
      }
      expect(fileDate).toHaveBeenCalledTimes(datesAfterListing);
    });

    it('does not fill the content cache with documents read for titles', async () => {
      const readFile = vi.fn().mockResolvedValue(Buffer.from('# T'));
      const { service } = build(
        base,
        {
          listDocuments: vi.fn().mockResolvedValue(files('a.md')),
          readFile,
        },
        createContentSourcesCaches(),
      );
      await service.listSource('rn', REQUEST);
      expect(readFile).toHaveBeenCalledTimes(1);
      await service.getDocument('rn', 'docs/releases/a.md', REQUEST);
      expect(readFile).toHaveBeenCalledTimes(2);
      await service.getDocument('rn', 'docs/releases/a.md', REQUEST);
      expect(readFile).toHaveBeenCalledTimes(2);
    });

    it('does not cache a document above 512 KiB', async () => {
      const readFile = vi
        .fn()
        .mockResolvedValue(Buffer.alloc(512 * 1024 + 1, 'a'));
      const { service } = build(base, { readFile });
      await service.getDocument('rn', 'docs/releases/big.md', REQUEST);
      await service.getDocument('rn', 'docs/releases/big.md', REQUEST);
      expect(readFile).toHaveBeenCalledTimes(2);
    });

    it('serves but does not cache a listing whose date lookup failed', async () => {
      let isFailing = true;
      const fileDate = vi.fn(async () => {
        if (isFailing) {
          throw new UpstreamError(UpstreamFailure.BadResponse, 'boom', 500);
        }
        return new Date('2025-01-01T00:00:00Z');
      });
      const listDocuments = vi.fn().mockResolvedValue(files('a.md'));
      const { service } = build(
        { ...base, date: ContentSourceDateMode.Updated },
        { listDocuments, fileDate },
      );

      const degraded = await service.listSource('rn', REQUEST);
      expect(degraded.documents[0].date).toBeNull();

      isFailing = false;
      const recovered = await service.listSource('rn', REQUEST);
      expect(recovered.documents[0].date).toBe('2025-01-01T00:00:00.000Z');
      expect(listDocuments).toHaveBeenCalledTimes(2);

      await service.listSource('rn', REQUEST);
      expect(listDocuments).toHaveBeenCalledTimes(2);
    });

    it('serves but does not cache a listing whose title read fell back', async () => {
      let isFailing = true;
      const readFile = vi.fn(async () => {
        if (isFailing) {
          throw new UpstreamError(UpstreamFailure.BadResponse, 'boom', 500);
        }
        return Buffer.from('# Real');
      });
      const { service } = build(base, {
        listDocuments: vi.fn().mockResolvedValue(files('a.md')),
        readFile,
      });
      expect((await service.listSource('rn', REQUEST)).documents[0].title).toBe(
        'a',
      );
      isFailing = false;
      expect((await service.listSource('rn', REQUEST)).documents[0].title).toBe(
        'Real',
      );
    });
  });

  describe('upstream admission', () => {
    /** A readFile that stays pending per call until released or aborted. */
    const heldReads = () => {
      const pending: {
        path: string;
        signal?: AbortSignal;
        release: () => void;
      }[] = [];
      const readFile = vi.fn(
        (
          _source: ContentSource,
          path: string,
          _maxBytes: number,
          context: ProviderContext,
        ) =>
          new Promise<Buffer>((resolve, reject) => {
            pending.push({
              path,
              signal: context.signal,
              release: () => resolve(Buffer.from(`bytes:${path}`)),
            });
            context.signal?.addEventListener('abort', () =>
              reject(new UpstreamError(UpstreamFailure.Unavailable, 'aborted')),
            );
          }),
      );
      return { pending, readFile };
    };

    const holdMisses = (
      service: ContentSourcesService,
      count: number,
      request: ContentSourcesRequest = REQUEST,
    ) =>
      Array.from({ length: count }, (_, index) =>
        service.getAsset('rn', `docs/held-${index}.png`, request),
      );

    afterEach(() => vi.useRealTimers());

    it('fails a listing instead of degrading when a title read is refused by a full queue', async () => {
      const { service } = build(base, {
        listDocuments: vi.fn().mockResolvedValue(files('a.md')),
        readFile: vi
          .fn()
          .mockRejectedValue(
            new UpstreamError(UpstreamFailure.QueueFull, 'full'),
          ),
      });
      await expect(service.listSource('rn', REQUEST)).rejects.toBeInstanceOf(
        ContentSourcesQueueFullException,
      );
    });

    it('cancels the pending reads of a listing every caller left', async () => {
      const { pending, readFile } = heldReads();
      const { service } = build(base, {
        listDocuments: vi.fn().mockResolvedValue(files('a.md', 'b.md')),
        readFile,
      });
      const client = new AbortController();
      const listing = service.listSource('rn', {
        ...REQUEST,
        signal: client.signal,
      });
      await vi.waitFor(() => expect(pending).toHaveLength(2));

      client.abort();
      await expect(listing).rejects.toMatchObject({ name: 'AbortError' });
      expect(pending.every((call) => call.signal?.aborted)).toBe(true);
    });

    it('answers 429 without a provider call once the user reaches the miss limit', async () => {
      const { pending, readFile } = heldReads();
      const { service, admission } = build(base, { readFile });
      const held = holdMisses(service, MISS_LIMIT);
      await vi.waitFor(() => expect(pending).toHaveLength(MISS_LIMIT));

      await expect(
        service.getAsset('rn', 'docs/one-more.png', REQUEST),
      ).rejects.toBeInstanceOf(ContentSourcesMissLimitException);
      expect(readFile).toHaveBeenCalledTimes(MISS_LIMIT);

      /* Another user is unaffected. */
      const other = service.getAsset('rn', 'docs/other.png', {
        principalKey: 'keycloak:user-2',
      });
      await vi.waitFor(() => expect(pending).toHaveLength(MISS_LIMIT + 1));

      pending.forEach((call) => call.release());
      await Promise.all([...held, other]);
      expect(admission.trackedPrincipalCount).toBe(0);
    });

    it('serves a fresh cached asset while the user is at the miss limit', async () => {
      const { pending, readFile } = heldReads();
      const { service } = build(base, { readFile });
      const warm = service.getAsset('rn', 'docs/hit.png', REQUEST);
      await vi.waitFor(() => expect(pending).toHaveLength(1));
      pending[0].release();
      await warm;

      const held = holdMisses(service, MISS_LIMIT);
      await vi.waitFor(() => expect(pending).toHaveLength(MISS_LIMIT + 1));
      await expect(
        service.getAsset('rn', 'docs/hit.png', REQUEST),
      ).resolves.toMatchObject({ bytes: Buffer.from('bytes:docs/hit.png') });

      pending.forEach((call) => call.release());
      await Promise.all(held);
    });

    it('does not count a request that joins an in-flight load', async () => {
      const { pending, readFile } = heldReads();
      const { service } = build(base, { readFile });
      const held = holdMisses(service, MISS_LIMIT);
      await vi.waitFor(() => expect(pending).toHaveLength(MISS_LIMIT));

      const joiner = service.getAsset('rn', 'docs/held-0.png', REQUEST);
      pending.forEach((call) => call.release());
      await expect(joiner).resolves.toMatchObject({
        bytes: Buffer.from('bytes:docs/held-0.png'),
      });
      await Promise.all(held);
      expect(readFile).toHaveBeenCalledTimes(MISS_LIMIT);
    });

    it('serves an expired entry stale when its refresh hits the miss limit', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      const staleServed = vi.spyOn(contentSourcesStaleServed, 'add');
      const { pending, readFile } = heldReads();
      const { service } = build(base, { readFile });
      const warm = service.getAsset('rn', 'docs/s.png', REQUEST);
      await vi.waitFor(() => expect(pending).toHaveLength(1));
      pending[0].release();
      await warm;
      vi.advanceTimersByTime(60_001);

      const held = holdMisses(service, MISS_LIMIT);
      await vi.waitFor(() => expect(pending).toHaveLength(MISS_LIMIT + 1));
      await expect(
        service.getAsset('rn', 'docs/s.png', REQUEST),
      ).resolves.toMatchObject({ bytes: Buffer.from('bytes:docs/s.png') });
      expect(readFile).toHaveBeenCalledTimes(MISS_LIMIT + 1);
      expect(staleServed).toHaveBeenCalledWith(1, {
        'dial.chat.content_sources.source': 'rn',
      });

      pending.forEach((call) => call.release());
      await Promise.all(held);
      staleServed.mockRestore();
    });

    it("counts a listing's nested loads once", async () => {
      const { pending, readFile } = heldReads();
      const fileDate = vi.fn().mockResolvedValue(null);
      const { service } = build(
        { ...base, date: ContentSourceDateMode.Updated },
        {
          listDocuments: vi
            .fn()
            .mockResolvedValue(
              files(...Array.from({ length: 20 }, (_, i) => `${i}.md`)),
            ),
          readFile,
          fileDate,
        },
      );
      const listing = service.listSource('rn', REQUEST);
      await vi.waitFor(() => expect(pending).toHaveLength(4));

      /* The listing holds one slot, so exactly MISS_LIMIT - 1 more fit. */
      const held = holdMisses(service, MISS_LIMIT - 1);
      await vi.waitFor(() => expect(pending).toHaveLength(4 + MISS_LIMIT - 1));
      await expect(
        service.getAsset('rn', 'docs/one-more.png', REQUEST),
      ).rejects.toBeInstanceOf(ContentSourcesMissLimitException);

      /*
       * Finish the listing while the user stays at the limit: its date loads
       * reuse the listing's slot, so the listing still succeeds.
       */
      let isDone = false;
      const result = listing.finally(() => {
        isDone = true;
      });
      while (!isDone) {
        for (const call of pending.filter((entry) =>
          entry.path.startsWith('docs/releases/'),
        )) {
          pending.splice(pending.indexOf(call), 1);
          call.release();
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      expect((await result).documents).toHaveLength(20);
      expect(fileDate).toHaveBeenCalledTimes(20);

      pending.forEach((call) => call.release());
      await Promise.all(held);
    });
  });
});

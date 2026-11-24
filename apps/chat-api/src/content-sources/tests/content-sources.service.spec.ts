import {
  BadRequestException,
  NotFoundException,
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createCache } from 'cache-manager';
import { describe, expect, it, vi } from 'vitest';
import {
  ContentProvider,
  UpstreamError,
  UpstreamFailure,
} from '../content-provider';
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
import { createContentSourcesCaches } from '../content-sources.module';
import { ContentSourcesService } from '../content-sources.service';
import { GitHubProvider } from '../providers/github.provider';
import { GitLabProvider } from '../providers/gitlab.provider';

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
  } as unknown as ContentSourcesRegistryService;
  const service = new ContentSourcesService(
    registry,
    new ContentSourcesCacheService(caches, registry),
    github as unknown as GitHubProvider,
    {} as GitLabProvider,
  );
  return { service, github };
};

const files = (...names: string[]) => ({
  files: names.map((name) => `docs/releases/${name}`),
  truncated: false,
});

describe('ContentSourcesService', () => {
  it('404s an unknown source', async () => {
    const { service } = build(base);
    await expect(service.listSource('nope')).rejects.toBeInstanceOf(
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
      const listing = await service.listSource('rn');
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
        (await service.listSource('rn')).documents.map((d) => d.path),
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
      const listing = await service.listSource('rn');
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
      await service.listSource('rn');
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
      await service.listSource('rn');
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
      expect((await service.listSource('rn')).documents).toHaveLength(200);
    });

    it('lists a file source as one document', async () => {
      const { service } = build({
        ...base,
        kind: ContentSourceKind.File,
        path: 'docs/guide.md',
      });
      const listing = await service.listSource('rn');
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
      expect((await service.listSource('rn')).documents[0].title).toBe('a');
    });

    it('fails the listing on a credential problem', async () => {
      const { service } = build(base, {
        listDocuments: vi
          .fn()
          .mockRejectedValue(
            new UpstreamError(UpstreamFailure.Credentials, 'no'),
          ),
      });
      await expect(service.listSource('rn')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('caches the assembled listing', async () => {
      const listDocuments = vi.fn().mockResolvedValue(files('a.md'));
      const { service } = build(base, { listDocuments });
      await service.listSource('rn');
      await service.listSource('rn');
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
      const doc = await service.getDocument('rn', 'docs/releases/./1.0.md');
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
        await expect(service.getDocument('rn', path)).rejects.toBeInstanceOf(
          BadRequestException,
        );
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
      await expect(service.getDocument('rn', path)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(github.readFile).not.toHaveBeenCalled();
    });

    it('only serves the configured path of a file source', async () => {
      const { service } = build({
        ...base,
        kind: ContentSourceKind.File,
        path: 'docs/guide.md',
      });
      await expect(
        service.getDocument('rn', 'docs/other.md'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getDocument('rn', 'docs/guide.md'),
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
        service.getDocument('rn', 'docs/releases/a.md'),
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
      expect((await service.getAsset('rn', path)).contentType).toBe(
        contentType,
      );
    });

    it('400s a disallowed extension', async () => {
      const { service, github } = build(base);
      await expect(
        service.getAsset('rn', 'docs/a.html'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.getAsset('rn', 'docs/noext')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(github.readFile).not.toHaveBeenCalled();
    });

    it('404s outside assetsPath, and normalizes ../ spellings first', async () => {
      const { service, github } = build(base);
      await expect(
        service.getAsset('rn', 'secret/a.png'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getAsset('rn', 'docs/releases/../../secret/a.png'),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        service.getAsset('rn', 'docs/releases/../img/a.png'),
      ).resolves.toBeDefined();
      expect(github.readFile.mock.calls[0][1]).toBe('docs/img/a.png');
    });

    it('does not cache an asset above 512 KiB', async () => {
      const readFile = vi.fn().mockResolvedValue(Buffer.alloc(512 * 1024 + 1));
      const { service } = build(base, { readFile });
      await service.getAsset('rn', 'docs/big.png');
      await service.getAsset('rn', 'docs/big.png');
      expect(readFile).toHaveBeenCalledTimes(2);
    });

    it('caches a small asset', async () => {
      const readFile = vi.fn().mockResolvedValue(Buffer.from('small'));
      const { service } = build(base, { readFile });
      await service.getAsset('rn', 'docs/s.png');
      await service.getAsset('rn', 'docs/./s.png');
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
      const listing = await service.listSource('rn');
      for (const { path } of listing.documents) {
        await expect(service.getDocument('rn', path)).resolves.toMatchObject({
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
      await service.listSource('rn');
      const datesAfterListing = fileDate.mock.calls.length;
      expect(datesAfterListing).toBe(200);

      for (const name of names) {
        await service.getDocument('rn', `docs/releases/${name}`);
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
      await service.listSource('rn');
      expect(readFile).toHaveBeenCalledTimes(1);
      await service.getDocument('rn', 'docs/releases/a.md');
      expect(readFile).toHaveBeenCalledTimes(2);
      await service.getDocument('rn', 'docs/releases/a.md');
      expect(readFile).toHaveBeenCalledTimes(2);
    });

    it('does not cache a document above 512 KiB', async () => {
      const readFile = vi
        .fn()
        .mockResolvedValue(Buffer.alloc(512 * 1024 + 1, 'a'));
      const { service } = build(base, { readFile });
      await service.getDocument('rn', 'docs/releases/big.md');
      await service.getDocument('rn', 'docs/releases/big.md');
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

      const degraded = await service.listSource('rn');
      expect(degraded.documents[0].date).toBeNull();

      isFailing = false;
      const recovered = await service.listSource('rn');
      expect(recovered.documents[0].date).toBe('2025-01-01T00:00:00.000Z');
      expect(listDocuments).toHaveBeenCalledTimes(2);

      await service.listSource('rn');
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
      expect((await service.listSource('rn')).documents[0].title).toBe('a');
      isFailing = false;
      expect((await service.listSource('rn')).documents[0].title).toBe('Real');
    });
  });
});

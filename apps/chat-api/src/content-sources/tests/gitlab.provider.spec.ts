import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ContentSource,
  ContentSourceDateMode,
  ContentSourceKind,
  ContentSourceProvider,
  ContentSourceSort,
  ContentSourcesRegistryService,
} from '../content-sources-registry.service';
import { ContentSourcesUpstreamService } from '../content-sources-upstream.service';
import { GitLabProvider } from '../providers/gitlab.provider';

const source: ContentSource = {
  id: 'guide',
  title: 'Guide',
  provider: ContentSourceProvider.GitLab,
  baseUrl: 'https://gitlab.example.com',
  repository: 'group/sub/project',
  ref: 'main',
  kind: ContentSourceKind.Directory,
  path: 'docs',
  include: '**/*.md',
  assetsPath: 'docs',
  sort: ContentSourceSort.NameAsc,
  date: ContentSourceDateMode.Created,
  feed: {},
  token: 'glpat-tok',
};
const ctx = {};
const json = (body: unknown, headers = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

describe('GitLabProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  const provider = new GitLabProvider(
    new ContentSourcesUpstreamService({
      timeoutMs: 1000,
      upstreamConcurrency: 8,
      upstreamQueueSize: 64,
    } as unknown as ContentSourcesRegistryService),
  );

  it('paginates the tree via x-next-page and sends PRIVATE-TOKEN', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(
          [
            { path: 'docs/a.md', type: 'blob' },
            { path: 'docs/img', type: 'tree' },
          ],
          { 'x-next-page': '2' },
        ),
      )
      .mockResolvedValueOnce(
        json([{ path: 'docs/img/b.png', type: 'blob' }], { 'x-next-page': '' }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.listDocuments(source, ctx);

    expect(result).toEqual({
      files: ['docs/a.md', 'docs/img/b.png'],
      truncated: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = new URL(String(fetchMock.mock.calls[0][0]));
    expect(first.pathname).toBe(
      '/api/v4/projects/group%2Fsub%2Fproject/repository/tree',
    );
    expect(first.searchParams.get('path')).toBe('docs');
    expect(first.searchParams.get('page')).toBe('1');
    expect(
      new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('page'),
    ).toBe('2');
    expect(fetchMock.mock.calls[0][1].headers['PRIVATE-TOKEN']).toBe(
      'glpat-tok',
    );
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('stops at the page cap and reports truncation', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        json([{ path: 'docs/a.md', type: 'blob' }], { 'x-next-page': '9' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const result = await provider.listDocuments(source, ctx);
    expect(result.truncated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(50);
  });

  it('reads a raw file with an encoded path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('# Hi', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = await provider.readFile(source, 'docs/a b.md', 1000, ctx);
    expect(body.toString()).toBe('# Hi');
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe(
      '/api/v4/projects/group%2Fsub%2Fproject/repository/files/docs%2Fa%20b.md/raw',
    );
    expect(url.searchParams.get('ref')).toBe('main');
  });

  it('accepts a numeric project id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json([]));
    vi.stubGlobal('fetch', fetchMock);
    await provider.listDocuments({ ...source, repository: '42' }, ctx);
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe(
      '/api/v4/projects/42/repository/tree',
    );
  });

  describe('fileDate', () => {
    it('uses the first commit for updated', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(json([{ committed_date: '2025-05-01T00:00:00Z' }]));
      vi.stubGlobal('fetch', fetchMock);
      const date = await provider.fileDate(
        source,
        'docs/a.md',
        ContentSourceDateMode.Updated,
        ctx,
      );
      expect(date?.toISOString()).toBe('2025-05-01T00:00:00.000Z');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('jumps to the last page for created', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          json([{ committed_date: '2025-05-01T00:00:00Z' }], {
            'x-total-pages': '4',
            'x-next-page': '2',
          }),
        )
        .mockResolvedValueOnce(
          json([{ committed_date: '2023-01-01T00:00:00Z' }]),
        );
      vi.stubGlobal('fetch', fetchMock);
      const date = await provider.fileDate(
        source,
        'docs/a.md',
        ContentSourceDateMode.Created,
        ctx,
      );
      expect(date?.toISOString()).toBe('2023-01-01T00:00:00.000Z');
      expect(
        new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('page'),
      ).toBe('4');
    });

    it('is null when the page count is unknown on a long history', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          json([{ committed_date: '2025-05-01T00:00:00Z' }], {
            'x-next-page': '2',
          }),
        ),
      );
      expect(
        await provider.fileDate(
          source,
          'a.md',
          ContentSourceDateMode.Created,
          ctx,
        ),
      ).toBeNull();
    });

    it('is null for a path with no commits', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([])));
      expect(
        await provider.fileDate(
          source,
          'a.md',
          ContentSourceDateMode.Updated,
          ctx,
        ),
      ).toBeNull();
    });
  });

  it('builds web URLs', () => {
    expect(provider.webUrl(source)).toBe(
      'https://gitlab.example.com/group/sub/project/-/tree/main/docs',
    );
    expect(provider.webUrl(source, 'docs/a.md', true)).toBe(
      'https://gitlab.example.com/group/sub/project/-/blob/main/docs/a.md',
    );
    expect(provider.webUrl({ ...source, repository: '42' })).toBe(
      'https://gitlab.example.com/projects/42',
    );
  });
});

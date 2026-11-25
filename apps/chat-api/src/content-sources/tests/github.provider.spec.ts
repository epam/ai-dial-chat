import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpstreamFailure } from '../content-provider';
import {
  ContentSource,
  ContentSourceDateMode,
  ContentSourceKind,
  ContentSourceProvider,
  ContentSourceSort,
  ContentSourcesRegistryService,
} from '../content-sources-registry.service';
import { ContentSourcesUpstreamService } from '../content-sources-upstream.service';
import { GitHubProvider } from '../providers/github.provider';

const source: ContentSource = {
  id: 'rn',
  title: 'RN',
  provider: ContentSourceProvider.GitHub,
  baseUrl: 'https://api.github.com',
  repository: 'epam/ai-dial',
  ref: 'main',
  kind: ContentSourceKind.Directory,
  path: 'docs/releases',
  include: '**/*.md',
  assetsPath: 'docs/releases',
  sort: ContentSourceSort.NameAsc,
  date: ContentSourceDateMode.Created,
  feed: {},
  token: 'ghp_tok',
};
const ctx = {};
const json = (body: unknown, headers = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers });

describe('GitHubProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  const provider = new GitHubProvider(
    new ContentSourcesUpstreamService({
      timeoutMs: 1000,
      upstreamConcurrency: 8,
      upstreamQueueSize: 64,
    } as unknown as ContentSourcesRegistryService),
  );

  it('lists blobs under the subtree with full paths and sends Bearer auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        tree: [
          { path: '1.0.md', type: 'blob' },
          { path: 'img', type: 'tree' },
          { path: 'img/a.png', type: 'blob' },
        ],
        truncated: false,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.listDocuments(source, ctx);

    expect(result).toEqual({
      files: ['docs/releases/1.0.md', 'docs/releases/img/a.png'],
      truncated: false,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://api.github.com/repos/epam/ai-dial/git/trees/main%3Adocs%2Freleases?recursive=1',
    );
    expect(init.headers.Authorization).toBe('Bearer ghp_tok');
  });

  it('reports a truncated tree', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ tree: [], truncated: true })),
    );
    expect((await provider.listDocuments(source, ctx)).truncated).toBe(true);
  });

  it('omits auth for an anonymous source', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ tree: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await provider.listDocuments({ ...source, token: undefined }, ctx);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('reads a file as raw bytes from the contents API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('# Title', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const body = await provider.readFile(
      source,
      'docs/releases/a b.md',
      1000,
      ctx,
    );
    expect(body.toString()).toBe('# Title');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://api.github.com/repos/epam/ai-dial/contents/docs/releases/a%20b.md?ref=main',
    );
    expect(init.headers.Accept).toBe('application/vnd.github.raw');
  });

  it('maps upstream 404 on read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    await expect(
      provider.readFile(source, 'x.md', 10, ctx),
    ).rejects.toMatchObject({ failure: UpstreamFailure.NotFound });
  });

  describe('fileDate', () => {
    const commit = (date: string) => [{ commit: { committer: { date } } }];

    it('returns the latest commit date for updated', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(json(commit('2025-03-01T10:00:00Z')));
      vi.stubGlobal('fetch', fetchMock);
      const date = await provider.fileDate(
        source,
        'docs/releases/1.0.md',
        ContentSourceDateMode.Updated,
        ctx,
      );
      expect(date?.toISOString()).toBe('2025-03-01T10:00:00.000Z');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = new URL(String(fetchMock.mock.calls[0][0]));
      expect(url.searchParams.get('path')).toBe('docs/releases/1.0.md');
      expect(url.searchParams.get('per_page')).toBe('1');
    });

    it('follows the last page for created', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          json(commit('2025-03-01T10:00:00Z'), {
            link: '<https://api.github.com/repositories/1/commits?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/commits?per_page=1&page=7>; rel="last"',
          }),
        )
        .mockResolvedValueOnce(json(commit('2024-01-02T00:00:00Z')));
      vi.stubGlobal('fetch', fetchMock);
      const date = await provider.fileDate(
        source,
        'a.md',
        ContentSourceDateMode.Created,
        ctx,
      );
      expect(date?.toISOString()).toBe('2024-01-02T00:00:00.000Z');
      expect(
        new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('page'),
      ).toBe('7');
    });

    it('returns null when no commit touches the path', async () => {
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

  it('builds web URLs from the API host', () => {
    expect(provider.webUrl(source)).toBe(
      'https://github.com/epam/ai-dial/tree/main/docs/releases',
    );
    expect(provider.webUrl(source, 'docs/releases/1.0.md', true)).toBe(
      'https://github.com/epam/ai-dial/blob/main/docs/releases/1.0.md',
    );
  });
});

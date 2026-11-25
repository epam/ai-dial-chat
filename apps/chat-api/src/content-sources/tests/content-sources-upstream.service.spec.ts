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
import {
  ContentSourceQueueOutcome,
  contentSourcesUpstreamQueueDuration,
} from '../content-sources-telemetry';
import { ContentSourcesUpstreamService } from '../content-sources-upstream.service';

const source = (overrides: Partial<ContentSource>): ContentSource => ({
  id: 'a',
  title: 'A',
  provider: ContentSourceProvider.GitHub,
  baseUrl: 'https://api.github.com',
  repository: 'epam/x',
  ref: 'main',
  kind: ContentSourceKind.Directory,
  path: 'docs',
  include: '**/*.md',
  assetsPath: 'docs',
  sort: ContentSourceSort.NameAsc,
  date: ContentSourceDateMode.None,
  feed: {},
  ...overrides,
});

const registry = (concurrency: number, queueSize = 10) =>
  ({
    timeoutMs: 1000,
    upstreamConcurrency: concurrency,
    upstreamQueueSize: queueSize,
  }) as unknown as ContentSourcesRegistryService;

/** A fetch whose calls stay open until released; tracks the URLs in flight. */
const holdingFetch = () => {
  const open: { url: string; release: () => void }[] = [];
  const fetchMock = vi.fn(
    (url: URL) =>
      new Promise<Response>((resolve) => {
        const entry = {
          url: url.toString(),
          release: () => {
            open.splice(open.indexOf(entry), 1);
            resolve(new Response('ok', { status: 200 }));
          },
        };
        open.push(entry);
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return { open, fetchMock };
};

const get = (
  service: ContentSourcesUpstreamService,
  target: ContentSource,
  path: string,
) =>
  service.fetch(
    target,
    {
      url: new URL(`${target.baseUrl}/${path}`),
      headers: {},
      maxBytes: 100,
    },
    {},
  );

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('ContentSourcesUpstreamService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shares one limit between sources with the same host and credential', async () => {
    const { open } = holdingFetch();
    const service = new ContentSourcesUpstreamService(registry(1));
    const one = source({ id: 'one', credentialId: 'gh', token: 't' });
    const two = source({ id: 'two', credentialId: 'gh', token: 't' });

    const first = get(service, one, 'a');
    const second = get(service, two, 'b');
    await settle();
    expect(open.map((call) => call.url)).toEqual(['https://api.github.com/a']);

    open[0].release();
    await first;
    await settle();
    expect(open.map((call) => call.url)).toEqual(['https://api.github.com/b']);
    open[0].release();
    await expect(second).resolves.toMatchObject({ status: 200 });
  });

  it('keeps separate limits for different credentials and for anonymous access', async () => {
    const { open } = holdingFetch();
    const service = new ContentSourcesUpstreamService(registry(1));
    const calls = [
      get(service, source({ id: 'x', credentialId: 'one', token: 't1' }), 'x'),
      get(service, source({ id: 'y', credentialId: 'two', token: 't2' }), 'y'),
      get(service, source({ id: 'z' }), 'z'),
      get(
        service,
        source({ id: 'w', baseUrl: 'https://gitlab.example.com' }),
        'w',
      ),
    ];
    await settle();
    expect(open).toHaveLength(4);
    open.slice().forEach((call) => call.release());
    await Promise.all(calls);
  });

  it('refuses a call with a full queue without sending it', async () => {
    const { open, fetchMock } = holdingFetch();
    const service = new ContentSourcesUpstreamService(registry(1, 0));
    const target = source({});
    const first = get(service, target, 'a');
    await settle();

    await expect(get(service, target, 'b')).rejects.toMatchObject({
      failure: UpstreamFailure.QueueFull,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    open[0].release();
    await first;
  });

  it('records each queue wait with the configured source id', async () => {
    const record = vi.spyOn(contentSourcesUpstreamQueueDuration, 'record');
    const { open } = holdingFetch();
    const service = new ContentSourcesUpstreamService(registry(1, 0));
    const target = source({ id: 'release-notes', credentialId: 'gh' });
    const first = get(service, target, 'a');
    await settle();
    await get(service, target, 'b').catch(() => undefined);
    open[0].release();
    await first;

    expect(record.mock.calls.map(([, attributes]) => attributes)).toEqual([
      {
        'dial.chat.content_sources.source': 'release-notes',
        'dial.chat.content_sources.queue_outcome':
          ContentSourceQueueOutcome.Admitted,
      },
      {
        'dial.chat.content_sources.source': 'release-notes',
        'dial.chat.content_sources.queue_outcome':
          ContentSourceQueueOutcome.QueueFull,
      },
    ]);
  });
});

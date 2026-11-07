import { ResponseError } from '@epam/ai-dial-chat-api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getCelebrationAssetUrl,
  getCelebrationCatalog,
  getCelebrationPack,
  loadCelebrationAssetJson,
} from '../celebrations.api';

const mockFetch = (body: unknown, status = 200) => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

const requestInit = (fetchMock: ReturnType<typeof mockFetch>) =>
  fetchMock.mock.calls[0]?.[1];

describe('celebrations generated client adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the catalog with the caller signal and no If-None-Match', async () => {
    const catalog = {
      schemaVersion: 1,
      revision: 'r1',
      packs: [],
      defaults: {},
    };
    const fetchMock = mockFetch(catalog);
    const controller = new AbortController();

    expect(await getCelebrationCatalog(controller.signal)).toEqual(catalog);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/celebrations',
      expect.objectContaining({ method: 'GET', signal: controller.signal }),
    );
    expect(
      new Headers(requestInit(fetchMock)?.headers).has('If-None-Match'),
    ).toBe(false);
  });

  it('fetches a pack version with the caller signal', async () => {
    const fetchMock = mockFetch({ packId: 'new-year-default' });
    const controller = new AbortController();

    await getCelebrationPack('new-year-default', '1.0.0', controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/celebrations/packs/new-year-default/1.0.0',
      expect.objectContaining({ method: 'GET', signal: controller.signal }),
    );
  });

  it('parses a JSON asset fetched with the caller signal', async () => {
    const fetchMock = mockFetch({ v: '5.7.0', w: 400, h: 300 });
    const controller = new AbortController();

    expect(
      await loadCelebrationAssetJson(
        'snowman.desktop.c574a799b1e315fe',
        controller.signal,
      ),
    ).toEqual({ v: '5.7.0', w: 400, h: 300 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/celebrations/assets/snowman.desktop.c574a799b1e315fe',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it.each([
    ['the catalog', () => getCelebrationCatalog()],
    ['a pack', () => getCelebrationPack('missing', '1.0.0')],
    ['an asset', () => loadCelebrationAssetJson('missing.0000000000000000')],
  ])('rejects %s on a non-2xx response', async (_name, call) => {
    mockFetch({ message: 'Service unavailable' }, 503);

    await expect(call()).rejects.toBeInstanceOf(ResponseError);
  });

  it('encodes the asset id into the image URL', () => {
    expect(getCelebrationAssetUrl('a/b?c')).toBe(
      '/api/v1/celebrations/assets/a%2Fb%3Fc',
    );
  });
});

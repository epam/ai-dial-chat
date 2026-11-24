import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SIGNED_OUT_MARKER_STORAGE_KEY } from '../../utils/signed-out-marker';
import {
  BOOT_PREFETCH_GLOBAL,
  BOOT_PREFETCH_MAX_AGE_MS,
  BOOT_PREFETCH_URLS,
  createBootPrefetchFetch,
  takeBootPrefetch,
} from '../boot-prefetch';

const PREFETCH_SCRIPT = readFileSync(
  join(__dirname, '../../../public/boot-prefetch.js'),
  'utf-8',
);

const runPrefetchScript = () => new Function(PREFETCH_SCRIPT)();

const globals = window as unknown as Record<string, unknown>;

const park = (responses: Record<string, Promise<Response>>, startedAt = 0) => {
  globals[BOOT_PREFETCH_GLOBAL] = { startedAt, responses };
};

describe('public/boot-prefetch.js', () => {
  let fetchSpy: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    global.fetch = fetchSpy;
  });

  afterEach(() => {
    delete globals[BOOT_PREFETCH_GLOBAL];
    window.sessionStorage.clear();
  });

  it('requests exactly the URLs the app takes, with credentials', () => {
    runPrefetchScript();

    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
      ...BOOT_PREFETCH_URLS,
    ]);
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual({
      credentials: 'include',
      cache: 'no-store',
    });
    const state = globals[BOOT_PREFETCH_GLOBAL] as {
      responses: Record<string, unknown>;
    };
    expect(Object.keys(state.responses)).toEqual([...BOOT_PREFETCH_URLS]);
  });

  it('sends nothing on the load right after a logout', () => {
    window.sessionStorage.setItem(
      SIGNED_OUT_MARKER_STORAGE_KEY,
      String(Date.now()),
    );

    runPrefetchScript();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(globals[BOOT_PREFETCH_GLOBAL]).toBeUndefined();
  });

  it('prefetches again once the logout marker is older than its TTL', () => {
    window.sessionStorage.setItem(
      SIGNED_OUT_MARKER_STORAGE_KEY,
      String(Date.now() - 61_000),
    );

    runPrefetchScript();

    expect(fetchSpy).toHaveBeenCalledTimes(BOOT_PREFETCH_URLS.length);
  });
});

describe('takeBootPrefetch', () => {
  afterEach(() => {
    delete globals[BOOT_PREFETCH_GLOBAL];
  });

  it('returns a parked response once', () => {
    const response = Promise.resolve(new Response('{}'));
    park({ '/api/v1/user-config': response });

    expect(takeBootPrefetch('/api/v1/user-config', 100)).toBe(response);
    expect(takeBootPrefetch('/api/v1/user-config', 100)).toBeUndefined();
  });

  it('drops a response older than the max age', () => {
    park({ '/api/v1/user-config': Promise.resolve(new Response('{}')) });

    expect(
      takeBootPrefetch('/api/v1/user-config', BOOT_PREFETCH_MAX_AGE_MS + 1),
    ).toBeUndefined();
  });

  it('returns nothing without the head script', () => {
    expect(takeBootPrefetch('/api/v1/user-config')).toBeUndefined();
  });
});

describe('createBootPrefetchFetch', () => {
  const network = vi.fn<typeof fetch>();
  const boot = createBootPrefetchFetch(network);

  beforeEach(() => {
    network.mockReset();
    network.mockResolvedValue(new Response('network'));
  });

  afterEach(() => {
    delete globals[BOOT_PREFETCH_GLOBAL];
  });

  it('answers the first GET of a parked URL from the head script', async () => {
    park(
      {
        '/api/v1/client-config?appId=ai-dial-chat': Promise.resolve(
          new Response('early'),
        ),
      },
      performance.now(),
    );

    const first = await boot('/api/v1/client-config?appId=ai-dial-chat', {
      method: 'GET',
    });
    const second = await boot('/api/v1/client-config?appId=ai-dial-chat', {
      method: 'GET',
    });

    expect(await first.text()).toBe('early');
    expect(await second.text()).toBe('network');
    expect(network).toHaveBeenCalledTimes(1);
  });

  it('matches an absolute same-origin URL', async () => {
    park(
      { '/api/v1/auth/me': Promise.resolve(new Response('early')) },
      performance.now(),
    );

    const response = await boot(`${window.location.origin}/api/v1/auth/me`);

    expect(await response.text()).toBe('early');
    expect(network).not.toHaveBeenCalled();
  });

  it('never answers a mutating request from the head script', async () => {
    park(
      { '/api/v1/user-config': Promise.resolve(new Response('early')) },
      performance.now(),
    );

    const response = await boot('/api/v1/user-config', { method: 'PUT' });

    expect(await response.text()).toBe('network');
  });

  it('sends the request again when the early one failed', async () => {
    park(
      { '/api/v1/auth/me': Promise.reject(new TypeError('offline')) },
      performance.now(),
    );

    const response = await boot('/api/v1/auth/me', { method: 'GET' });

    expect(await response.text()).toBe('network');
    expect(network).toHaveBeenCalledWith('/api/v1/auth/me', { method: 'GET' });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpstreamError, UpstreamFailure } from '../content-provider';
import { fetchUpstream } from '../upstream-fetch';

const TOKEN = 'ghp_secret_token';
const request = (overrides = {}) => ({
  url: new URL('https://api.github.com/repos/epam/x'),
  origin: 'https://api.github.com',
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeoutMs: 1000,
  maxBytes: 100,
  sourceId: 'docs',
  ...overrides,
});

const respond = (status: number, body = '', headers = {}) =>
  vi.fn().mockResolvedValue(new Response(body || null, { status, headers }));

const failure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as UpstreamError;
  }
  throw new Error('expected rejection');
};

describe('fetchUpstream', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns status, headers and body', async () => {
    const fetchMock = respond(200, 'hello', { 'x-a': 'b' });
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchUpstream(request());
    expect(result.body.toString()).toBe('hello');
    expect(result.headers.get('x-a')).toBe('b');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it.each([
    [404, UpstreamFailure.NotFound],
    [401, UpstreamFailure.Credentials],
    [403, UpstreamFailure.Credentials],
    [429, UpstreamFailure.Unavailable],
    [503, UpstreamFailure.Unavailable],
    [500, UpstreamFailure.BadResponse],
    [302, UpstreamFailure.BadResponse],
  ])('classifies upstream %i', async (status, expected) => {
    vi.stubGlobal('fetch', respond(status));
    expect((await failure(fetchUpstream(request()))).failure).toBe(expected);
  });

  it.each([[{ 'x-ratelimit-remaining': '0' }], [{ 'retry-after': '60' }]])(
    'treats a rate-limited 403 (%j) as unavailable, not as a credential problem',
    async (headers) => {
      vi.stubGlobal('fetch', respond(403, '', headers));
      expect((await failure(fetchUpstream(request()))).failure).toBe(
        UpstreamFailure.Unavailable,
      );
    },
  );

  it('still treats a plain 403 as a credential problem', async () => {
    vi.stubGlobal('fetch', respond(403, '', { 'x-ratelimit-remaining': '42' }));
    expect((await failure(fetchUpstream(request()))).failure).toBe(
      UpstreamFailure.Credentials,
    );
  });

  it('treats a network error or timeout as unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('boom')));
    expect((await failure(fetchUpstream(request()))).failure).toBe(
      UpstreamFailure.Unavailable,
    );
  });

  it('rejects an oversized body by Content-Length and while streaming', async () => {
    vi.stubGlobal('fetch', respond(200, 'x', { 'content-length': '101' }));
    expect((await failure(fetchUpstream(request()))).failure).toBe(
      UpstreamFailure.TooLarge,
    );
    vi.stubGlobal('fetch', respond(200, 'x'.repeat(101)));
    expect((await failure(fetchUpstream(request()))).failure).toBe(
      UpstreamFailure.TooLarge,
    );
  });

  it('refuses a destination outside the configured origin', async () => {
    const fetchMock = respond(200);
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      fetchUpstream(request({ url: new URL('https://evil.example.com/x') })),
    ).rejects.toThrow(/escaped/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never puts the token in an error', async () => {
    vi.stubGlobal('fetch', respond(401));
    const error = await failure(fetchUpstream(request()));
    expect(error.message).not.toContain(TOKEN);
  });
});

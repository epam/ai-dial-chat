import {
  BadGatewayException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CelebrationsUpstreamReader,
  type CelebrationUpstreamRequest,
} from '../celebrations-upstream.reader';
import { CelebrationResourceKind } from '../types/celebration';
import {
  CELEBRATIONS_URL,
  NEW_YEAR_MANIFEST,
  THEMES_ENV,
  configWith,
  fixtureAsset,
  mockThemesHost,
  readFixture,
  sha256,
} from './celebrations.fixtures';

const poster = () => fixtureAsset(NEW_YEAR_MANIFEST, 'snowman-delivery.poster');

const posterRequest = (
  overrides: Partial<CelebrationUpstreamRequest> = {},
): CelebrationUpstreamRequest => {
  const { assetId, path, bytes, sha256: hash, mediaType } = poster();
  return {
    kind: CelebrationResourceKind.Asset,
    id: assetId,
    path,
    maxBytes: 100 * 1024,
    expected: { bytes, sha256: hash, mediaType },
    ...overrides,
  };
};

describe('CelebrationsUpstreamReader', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  const reader = (env = THEMES_ENV) =>
    new CelebrationsUpstreamReader(configWith(env));

  beforeEach(() => {
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns verified bytes from under the celebrations directory', async () => {
    const { requests, fetchMock } = mockThemesHost();
    const body = await reader().read(posterRequest());

    expect(body.equals(readFixture(poster().path))).toBe(true);
    expect(requests).toEqual([`${CELEBRATIONS_URL}${poster().path}`]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: 'manual' }),
    );
  });

  it('resolves under a THEMES_CONFIG_URL that has a path and a trailing slash', async () => {
    /* The fake host serves only the root layout, so this read ends in 404. */
    const { requests } = mockThemesHost();
    await reader({
      ...THEMES_ENV,
      THEMES_CONFIG_URL: 'http://themes.test/static/',
    })
      .read(posterRequest())
      .catch(() => undefined);
    expect(requests).toEqual([
      `http://themes.test/static/celebrations/${poster().path}`,
    ]);
  });

  it.each([
    ['a parent segment', '../config.json'],
    ['a nested parent segment', 'new-year-default/../../config.json'],
    ['an encoded parent segment', '%2e%2e/config.json'],
    ['an absolute path', '/config.json'],
    ['an absolute URL', 'http://evil.test/x.json'],
    ['a protocol-relative URL', '//evil.test/x.json'],
    ['a backslash', 'new-year-default\\manifest.json'],
    ['a scheme', 'data:application/json,{}'],
    ['an empty segment', 'new-year-default//manifest.json'],
  ])('rejects %s with 404 and no request', async (_, path) => {
    const { fetchMock } = mockThemesHost();
    await expect(
      reader().read(posterRequest({ path, expected: undefined })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('path leaves the celebrations directory'),
    );
  });

  it('answers 503 without a request when THEMES_CONFIG_URL is unset', async () => {
    const { fetchMock } = mockThemesHost();
    await expect(reader({}).read(posterRequest())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps an upstream 404 to 404', async () => {
    mockThemesHost({ 'index.json': new Response('', { status: 404 }) });
    await expect(
      reader().read(posterRequest({ path: 'index.json', expected: undefined })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a redirect with 502', async () => {
    mockThemesHost({
      [poster().path]: new Response(null, {
        status: 302,
        headers: { location: 'http://evil.test/' },
      }),
    });
    await expect(reader().read(posterRequest())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('upstream status 302'),
    );
  });

  it('answers 503 when the upstream does not respond in time', async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, rejectFetch) => {
          init?.signal?.addEventListener('abort', () =>
            rejectFetch(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    const read = reader({ ...THEMES_ENV, THEMES_SERVICE_TIMEOUT_MS: 100 }).read(
      posterRequest(),
    );
    const assertion = expect(read).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('timed out'));
  });

  it('answers 503 when the upstream is unreachable', async () => {
    mockThemesHost({ [poster().path]: new TypeError('fetch failed') });
    await expect(reader().read(posterRequest())).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('stops reading a stream once it exceeds the cap, whatever its declared length', async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(new Uint8Array(1024));
      },
    });
    mockThemesHost({ [poster().path]: new Response(stream) });

    await expect(
      reader().read(posterRequest({ maxBytes: 4096, expected: undefined })),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(pulled).toBeLessThan(10);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('body exceeds 4096 bytes'),
    );
  });

  it('rejects a declared Content-Length over the cap before reading', async () => {
    mockThemesHost({
      [poster().path]: new Response('x', {
        headers: { 'content-length': '999999' },
      }),
    });
    await expect(
      reader().read(posterRequest({ maxBytes: 4096, expected: undefined })),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects bytes whose length differs from the declared bytes', async () => {
    mockThemesHost({ [poster().path]: `${readFixture(poster().path)} ` });
    await expect(reader().read(posterRequest())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/differs from the declared/),
    );
  });

  it('rejects bytes whose hash differs from the declared sha256 and logs no body', async () => {
    const original = readFixture(poster().path);
    const tampered = Buffer.from(original);
    tampered[tampered.length - 2] ^= 1;
    mockThemesHost({ [poster().path]: tampered });

    await expect(reader().read(posterRequest())).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(warn).toHaveBeenCalledOnce();
    const [message] = warn.mock.calls[0] as [string];
    expect(message).toContain(poster().assetId);
    expect(message).toContain('hash differs');
    expect(message).not.toContain('<svg');
    expect(sha256(tampered)).not.toBe(poster().sha256);
  });

  it('rejects a media type outside the allowlist without a request', async () => {
    const { fetchMock } = mockThemesHost();
    const { bytes, sha256: hash } = poster();
    await expect(
      reader().read(
        posterRequest({
          expected: { bytes, sha256: hash, mediaType: 'text/html' },
        }),
      ),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

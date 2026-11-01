import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import type { AddressInfo } from 'node:net';
import { promisify } from 'node:util';
import { brotliDecompress } from 'node:zlib';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  INestApplication,
  Logger,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { EnvironmentVariables } from '../../config/environment.config';
import { CelebrationCatalogService } from '../celebration-catalog.service';
import { CelebrationsUpstreamReader } from '../celebrations-upstream.reader';
import { CelebrationsController } from '../celebrations.controller';
import { ImmutableResourceStore } from '../immutable-resource.store';
import {
  ANNIVERSARY_MANIFEST,
  NEW_YEAR_MANIFEST,
  THEMES_ENV,
  configWith,
  fixtureAsset,
  indexWithManifest,
  mockThemesHost,
  readFixture,
  readJsonFixture,
  sha256,
  type FakeUpstreamAnswer,
} from './celebrations.fixtures';

// supertest is CJS; use require to avoid vite ESM interop issues
const request = require('supertest') as (
  app: Parameters<typeof import('supertest')>[0],
) => import('supertest').SuperTest<import('supertest').Test>;

interface RawResponse {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
}

/* supertest decodes compressed bodies; this reads the bytes as sent. */
const rawGet = (
  app: INestApplication,
  path: string,
  headers: Record<string, string> = {},
): Promise<RawResponse> => {
  const { port } = app.getHttpServer().address() as AddressInfo;
  return new Promise((resolve, reject) => {
    httpRequest({ host: '127.0.0.1', port, path, headers }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode ?? 0,
          headers: response.headers,
          body: Buffer.concat(chunks),
        }),
      );
    })
      .on('error', reject)
      .end();
  });
};

const createCache = () => {
  const entries = new Map<string, unknown>();
  return {
    get: async (key: string) => entries.get(key),
    set: async (key: string, value: unknown) => {
      entries.set(key, value);
    },
  };
};

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000',
  'hex',
);

describe('CelebrationsController (integration)', () => {
  let app: INestApplication;

  const start = async (
    answers: Record<
      string,
      FakeUpstreamAnswer | (() => FakeUpstreamAnswer)
    > = {},
    env: Partial<EnvironmentVariables> = THEMES_ENV,
  ) => {
    const host = mockThemesHost(answers);
    /* The module's own providers, plus the globals AppModule supplies. */
    const moduleFixture = await Test.createTestingModule({
      controllers: [CelebrationsController],
      providers: [
        CelebrationCatalogService,
        CelebrationsUpstreamReader,
        {
          provide: ImmutableResourceStore,
          useValue: new ImmutableResourceStore(),
        },
        { provide: ConfigService, useValue: configWith(env) },
        { provide: CACHE_MANAGER, useValue: createCache() },
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(0, '127.0.0.1');
    return host;
  };

  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  it('is public', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, CelebrationsController)).toBe(
      true,
    );
  });

  describe('GET /v1/celebrations', () => {
    it('returns the catalog with a 60-second cache, an ETag and Vary', async () => {
      await start();
      const response = await request(app.getHttpServer())
        .get('/v1/celebrations')
        .expect(200);

      expect(response.body).toEqual({
        schemaVersion: 1,
        revision: '2026-11-15.1',
        packs: [
          {
            packId: 'new-year-default',
            version: '1.0.0',
            eventId: 'new-year',
          },
          {
            packId: 'company-anniversary',
            version: '1.0.0',
            eventId: 'company-anniversary',
          },
        ],
        defaults: {
          'new-year': { packId: 'new-year-default', version: '1.0.0' },
          'company-anniversary': {
            packId: 'company-anniversary',
            version: '1.0.0',
          },
        },
      });
      expect(response.headers['cache-control']).toBe(
        'public, max-age=60, must-revalidate',
      );
      expect(response.headers['content-type']).toBe(
        'application/json; charset=utf-8',
      );
      expect(response.headers.vary).toBe('Accept-Encoding');
      expect(response.headers.etag).toBeTruthy();
    });

    it('answers 304 to a matching If-None-Match', async () => {
      await start();
      const first = await rawGet(app, '/v1/celebrations');
      const second = await rawGet(app, '/v1/celebrations', {
        'If-None-Match': first.headers.etag as string,
      });
      expect(second.status).toBe(304);
      expect(second.body.length).toBe(0);
    });

    it('answers 404 when no index is published', async () => {
      await start({ 'index.json': new Response('', { status: 404 }) });
      await request(app.getHttpServer()).get('/v1/celebrations').expect(404);
    });

    it('answers 502 for an unsupported schemaVersion', async () => {
      await start({ 'index.json': '{"schemaVersion":2}' });
      await request(app.getHttpServer()).get('/v1/celebrations').expect(502);
    });

    it('answers 503 when THEMES_CONFIG_URL is unset', async () => {
      const { fetchMock } = await start({}, {});
      await request(app.getHttpServer()).get('/v1/celebrations').expect(503);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 503 when the themes host times out', async () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      await start({}, { ...THEMES_ENV, THEMES_SERVICE_TIMEOUT_MS: 20 });
      vi.mocked(globalThis.fetch).mockImplementation(
        (_input, init) =>
          new Promise((_resolve, rejectFetch) => {
            init?.signal?.addEventListener('abort', () =>
              rejectFetch(new DOMException('aborted', 'AbortError')),
            );
          }),
      );
      await request(app.getHttpServer()).get('/v1/celebrations').expect(503);
    });
  });

  describe('GET /v1/celebrations/packs/:packId/:version', () => {
    it('returns the pack with immutable caching and no upstream paths', async () => {
      await start();
      const response = await request(app.getHttpServer())
        .get('/v1/celebrations/packs/new-year-default/1.0.0')
        .expect(200);

      expect(response.body).toMatchObject({
        packId: 'new-year-default',
        catalogRevision: '2026-11-15.1',
        scenes: [{ id: 'snowman-delivery' }],
      });
      expect(response.text).not.toMatch(/manifest\.json|"file"|"path"/);
      expect(response.headers['cache-control']).toBe(
        'public, max-age=31536000, immutable',
      );
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it.each([
      [
        'an uppercase packId',
        '/v1/celebrations/packs/New-Year/1.0.0',
        'packId',
      ],
      [
        'a pre-release version',
        '/v1/celebrations/packs/new-year-default/1.0.0-rc.1',
        'version',
      ],
      [
        'an encoded traversal',
        '/v1/celebrations/packs/..%2F..%2Fconfig/1.0.0',
        'packId',
      ],
    ])(
      'answers 400 for %s without an upstream request',
      async (_, path, field) => {
        const { fetchMock } = await start();
        const response = await request(app.getHttpServer())
          .get(path)
          .expect(400);
        expect(JSON.stringify(response.body.message)).toContain(field);
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it('answers 404 for a version the index does not list', async () => {
      await start();
      await request(app.getHttpServer())
        .get('/v1/celebrations/packs/new-year-default/2.0.0')
        .expect(404);
    });

    it('answers 502 for a manifest whose bytes no longer match the index', async () => {
      const tampered = Buffer.from(
        readFixture(NEW_YEAR_MANIFEST).toString().replace('12000', '12001'),
      );
      await start({ [NEW_YEAR_MANIFEST]: tampered });
      await request(app.getHttpServer())
        .get('/v1/celebrations/packs/new-year-default/1.0.0')
        .expect(502);
    });

    it('answers 502 for a manifest with an unsupported schemaVersion', async () => {
      await start(
        indexWithManifest(NEW_YEAR_MANIFEST, {
          ...readJsonFixture<Record<string, unknown>>(NEW_YEAR_MANIFEST),
          schemaVersion: 2,
        }),
      );
      await request(app.getHttpServer())
        .get('/v1/celebrations/packs/new-year-default/1.0.0')
        .expect(502);
    });

    it('answers 502 when the themes host redirects', async () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      await start({
        [ANNIVERSARY_MANIFEST]: new Response(null, {
          status: 302,
          headers: { location: 'http://evil.test/manifest.json' },
        }),
      });
      await request(app.getHttpServer())
        .get('/v1/celebrations/packs/company-anniversary/1.0.0')
        .expect(502);
    });
  });

  describe('GET /v1/celebrations/assets/:assetId', () => {
    const desktop = () =>
      fixtureAsset(NEW_YEAR_MANIFEST, 'snowman-delivery.desktop');
    const poster = () =>
      fixtureAsset(NEW_YEAR_MANIFEST, 'snowman-delivery.poster');

    it('serves Brotli that decodes to the declared sha256', async () => {
      await start();
      const response = await rawGet(
        app,
        `/v1/celebrations/assets/${desktop().assetId}`,
        { 'Accept-Encoding': 'gzip, br' },
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-encoding']).toBe('br');
      expect(response.headers.vary).toBe('Accept-Encoding');
      expect(response.headers['cache-control']).toBe(
        'public, max-age=31536000, immutable',
      );
      const decoded = await promisify(brotliDecompress)(response.body);
      expect(sha256(decoded)).toBe(desktop().sha256);
    });

    it('serves identity bytes of the declared length without Accept-Encoding', async () => {
      await start();
      const response = await rawGet(
        app,
        `/v1/celebrations/assets/${desktop().assetId}`,
      );

      expect(response.headers['content-encoding']).toBeUndefined();
      expect(Number(response.headers['content-length'])).toBe(desktop().bytes);
      expect(sha256(response.body)).toBe(desktop().sha256);
    });

    it('serves SVG with the sandboxing CSP and nosniff', async () => {
      await start();
      const response = await rawGet(
        app,
        `/v1/celebrations/assets/${poster().assetId}`,
      );

      expect(response.headers['content-type']).toBe('image/svg+xml');
      expect(response.headers['content-security-policy']).toBe(
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      );
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('serves a PNG as identity even when Brotli is accepted', async () => {
      const manifest = readJsonFixture<{
        assets: Record<string, unknown>[];
        scenes: Record<string, unknown>[];
      }>(NEW_YEAR_MANIFEST);
      const hash = sha256(PNG);
      const assetId = `new-year-default-poster-png-${hash.slice(0, 16)}`;
      manifest.assets[2] = {
        assetId,
        file: 'poster.png',
        mediaType: 'image/png',
        bytes: PNG.length,
        sha256: hash,
      };
      manifest.scenes[0].posterAssetId = assetId;
      await start({
        ...indexWithManifest(NEW_YEAR_MANIFEST, manifest),
        'new-year-default/1.0.0/poster.png': PNG,
      });

      const response = await rawGet(app, `/v1/celebrations/assets/${assetId}`, {
        'Accept-Encoding': 'br',
      });
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers['content-encoding']).toBeUndefined();
      expect(response.headers.vary).toBeUndefined();
      expect(response.body.equals(PNG)).toBe(true);
    });

    it('answers 400 for a traversal attempt without an upstream request', async () => {
      const { fetchMock } = await start();
      const response = await request(app.getHttpServer())
        .get('/v1/celebrations/assets/..%2Findex.json')
        .expect(400);
      expect(response.body.message).toEqual([
        'assetId must be a lowercase asset identifier',
      ]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown asset without requesting it', async () => {
      const { requests } = await start();
      await request(app.getHttpServer())
        .get('/v1/celebrations/assets/unknown-0123456789abcdef')
        .expect(404);
      expect(requests.some((url) => url.includes('unknown'))).toBe(false);
    });

    it('answers 502 for an asset whose hash differs from the manifest', async () => {
      vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const tampered = Buffer.from(readFixture(poster().path));
      tampered[tampered.length - 2] ^= 1;
      await start({ [poster().path]: tampered });
      await request(app.getHttpServer())
        .get(`/v1/celebrations/assets/${poster().assetId}`)
        .expect(502);
    });

    it('answers 502 for an asset larger than its cap, whatever it declares', async () => {
      await start({ [desktop().path]: Buffer.alloc(300 * 1024 + 1, 0x20) });
      await request(app.getHttpServer())
        .get(`/v1/celebrations/assets/${desktop().assetId}`)
        .expect(502);
    });
  });
});

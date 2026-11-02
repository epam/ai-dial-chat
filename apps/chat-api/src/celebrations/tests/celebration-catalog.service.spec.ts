import {
  BadGatewayException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CelebrationCatalogService } from '../celebration-catalog.service';
import { CelebrationsUpstreamReader } from '../celebrations-upstream.reader';
import {
  CELEBRATION_INDEX_CACHE_KEY,
  CELEBRATION_INDEX_TTL_MS,
} from '../constants/celebrations.constants';
import { ImmutableResourceStore } from '../immutable-resource.store';
import { CelebrationContentEncoding } from '../types/celebration';
import {
  ANNIVERSARY_MANIFEST,
  CELEBRATIONS_URL,
  NEW_YEAR_MANIFEST,
  THEMES_ENV,
  configWith,
  fixtureAsset,
  indexWithManifest,
  mockThemesHost,
  readFixture,
  readJsonFixture,
  sha256,
} from './celebrations.fixtures';

/* A TTL-aware stand-in for the shared app cache. */
const createCache = () => {
  const entries = new Map<string, { value: unknown; expiresAt: number }>();
  const cache = {
    get: vi.fn(async (key: string) => {
      const entry = entries.get(key);
      return entry && entry.expiresAt > Date.now() ? entry.value : undefined;
    }),
    set: vi.fn(async (key: string, value: unknown, ttl: number) => {
      entries.set(key, { value, expiresAt: Date.now() + ttl });
    }),
  };
  return cache;
};

describe('CelebrationCatalogService', () => {
  let cache: ReturnType<typeof createCache>;
  let warn: ReturnType<typeof vi.spyOn>;
  const createService = (env = THEMES_ENV) =>
    new CelebrationCatalogService(
      new CelebrationsUpstreamReader(configWith(env)),
      new ImmutableResourceStore(),
      cache as never,
    );

  beforeEach(() => {
    cache = createCache();
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('getCatalog', () => {
    it('caches the normalized index for 60 seconds', async () => {
      vi.useFakeTimers();
      const { requests } = mockThemesHost();
      const service = createService();

      await expect(service.getCatalog()).resolves.toMatchObject({
        revision: '2026-11-15.1',
      });
      await service.getCatalog();
      expect(requests).toHaveLength(1);
      expect(cache.set).toHaveBeenCalledWith(
        CELEBRATION_INDEX_CACHE_KEY,
        expect.anything(),
        CELEBRATION_INDEX_TTL_MS,
      );

      vi.advanceTimersByTime(CELEBRATION_INDEX_TTL_MS + 1);
      await service.getCatalog();
      expect(requests).toHaveLength(2);
    });

    it('returns a new revision after the TTL and keeps older manifests servable', async () => {
      vi.useFakeTimers();
      const index = readJsonFixture('index.json');
      let revision = '2026-11-15.1';
      mockThemesHost({
        'index.json': () => JSON.stringify({ ...index, revision }),
      });
      const service = createService();
      await service.getPack('new-year-default', '1.0.0');

      revision = '2026-11-20.1';
      vi.advanceTimersByTime(CELEBRATION_INDEX_TTL_MS + 1);
      await expect(service.getCatalog()).resolves.toMatchObject({ revision });
      await expect(
        service.getPack('new-year-default', '1.0.0'),
      ).resolves.toMatchObject({ catalogRevision: revision });
    });

    it('serves the last valid revision when a refetch is invalid', async () => {
      vi.useFakeTimers();
      let body: string | Buffer = readFixture('index.json');
      mockThemesHost({ 'index.json': () => body });
      const service = createService();
      await service.getCatalog();

      body = JSON.stringify({ schemaVersion: 2 });
      vi.advanceTimersByTime(CELEBRATION_INDEX_TTL_MS + 1);
      await expect(service.getCatalog()).resolves.toMatchObject({
        revision: '2026-11-15.1',
      });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('unsupported schemaVersion 2'),
      );
    });

    it('rejects an invalid first index with 502', async () => {
      mockThemesHost({ 'index.json': '{"schemaVersion": 2}' });
      await expect(createService().getCatalog()).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('rejects an index nested deeper than 32 with 502', async () => {
      mockThemesHost({
        'index.json': `{"a":${'['.repeat(40)}${']'.repeat(40)}}`,
      });
      await expect(createService().getCatalog()).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('answers 404 when no index is published', async () => {
      mockThemesHost({ 'index.json': new Response('', { status: 404 }) });
      await expect(createService().getCatalog()).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('shares one upstream request between concurrent misses', async () => {
      const { requests } = mockThemesHost();
      const service = createService();
      await Promise.all(Array.from({ length: 5 }, () => service.getCatalog()));
      expect(requests).toHaveLength(1);
    });
  });

  describe('getPack', () => {
    it('returns the pack with the catalog revision and no upstream paths', async () => {
      mockThemesHost();
      const pack = await createService().getPack('new-year-default', '1.0.0');

      expect(pack).toMatchObject({
        packId: 'new-year-default',
        catalogRevision: '2026-11-15.1',
        scenes: [{ id: 'snowman-delivery' }],
      });
      expect(Object.keys(pack)).toEqual([
        'packId',
        'version',
        'eventId',
        'catalogRevision',
        'requiredCapabilities',
        'assets',
        'labels',
        'scenes',
      ]);
      expect(JSON.stringify(pack)).not.toMatch(/"file"|"path"|manifest\.json/);
    });

    it('answers 404 for an unlisted version without requesting a manifest', async () => {
      const { requests } = mockThemesHost();
      await expect(
        createService().getPack('new-year-default', '9.9.9'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(requests).toEqual([`${CELEBRATIONS_URL}index.json`]);
    });

    it('treats a manifest path outside the celebrations directory as unpublished', async () => {
      const index = readJsonFixture<{ packs: Record<string, unknown>[] }>(
        'index.json',
      );
      index.packs[0] = {
        ...index.packs[0],
        manifest: {
          ...(index.packs[0].manifest as object),
          path: '../config.json',
        },
      };
      const { requests } = mockThemesHost({
        'index.json': JSON.stringify(index),
      });

      await expect(
        createService().getPack('new-year-default', '1.0.0'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(requests).toEqual([`${CELEBRATIONS_URL}index.json`]);
    });

    it('rejects republished manifest bytes with 502 and caches nothing', async () => {
      const original = readFixture(NEW_YEAR_MANIFEST);
      const tampered = Buffer.from(
        original.toString().replace('12000', '12001'),
      );
      let manifest: Buffer = tampered;
      const { requests } = mockThemesHost({
        [NEW_YEAR_MANIFEST]: () => manifest,
      });
      const service = createService();

      await expect(
        service.getPack('new-year-default', '1.0.0'),
      ).rejects.toBeInstanceOf(BadGatewayException);
      manifest = original;
      await expect(
        service.getPack('new-year-default', '1.0.0'),
      ).resolves.toMatchObject({ packId: 'new-year-default' });
      expect(
        requests.filter((url) => url.endsWith(NEW_YEAR_MANIFEST)),
      ).toHaveLength(2);
    });

    it('rejects an invalid manifest with 502 and does not cache it', async () => {
      const manifest = {
        ...readJsonFixture(NEW_YEAR_MANIFEST),
        schemaVersion: 2,
      };
      const { requests } = mockThemesHost(
        indexWithManifest('new-year-default/1.0.0/manifest.json', manifest),
      );
      const service = createService();

      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(
          service.getPack('new-year-default', '1.0.0'),
        ).rejects.toBeInstanceOf(BadGatewayException);
      }
      expect(
        requests.filter((url) => url.endsWith('manifest.json')),
      ).toHaveLength(2);
    });

    it('rejects the second manifest that declares a known asset ID with another hash', async () => {
      const newYear = readJsonFixture<{ assets: Record<string, unknown>[] }>(
        NEW_YEAR_MANIFEST,
      );
      const anniversary = readJsonFixture<{
        assets: Record<string, unknown>[];
      }>(ANNIVERSARY_MANIFEST);
      /* Same ID and hash prefix as a new-year asset, different full hash. */
      const stolen = newYear.assets[0];
      anniversary.assets[0] = {
        ...anniversary.assets[0],
        assetId: stolen.assetId,
        sha256: `${(stolen.sha256 as string).slice(0, 16)}${'0'.repeat(48)}`,
      };
      (anniversary as Record<string, unknown>).scenes = (
        anniversary as unknown as { scenes: Record<string, unknown>[] }
      ).scenes.map((scene) => ({
        ...scene,
        variants: [{ when: {}, animationAssetId: stolen.assetId }],
      }));
      const anniversaryBytes = Buffer.from(JSON.stringify(anniversary));
      const index = readJsonFixture<{ packs: Record<string, unknown>[] }>(
        'index.json',
      );
      index.packs[1] = {
        ...index.packs[1],
        manifest: {
          path: ANNIVERSARY_MANIFEST,
          bytes: anniversaryBytes.length,
          sha256: sha256(anniversaryBytes),
        },
      };
      mockThemesHost({
        'index.json': JSON.stringify(index),
        [ANNIVERSARY_MANIFEST]: anniversaryBytes,
      });
      const service = createService();

      await service.getPack('new-year-default', '1.0.0');
      await expect(
        service.getPack('company-anniversary', '1.0.0'),
      ).rejects.toBeInstanceOf(BadGatewayException);
      await expect(
        service.getPack('new-year-default', '1.0.0'),
      ).resolves.toMatchObject({ packId: 'new-year-default' });
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('collides with a different sha256'),
      );
    });

    it('answers 503 when THEMES_CONFIG_URL is unset', async () => {
      mockThemesHost();
      await expect(
        createService({}).getPack('new-year-default', '1.0.0'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('getAsset', () => {
    const poster = () =>
      fixtureAsset(NEW_YEAR_MANIFEST, 'snowman-delivery.poster');

    it('returns verified bytes and serves repeats from the store', async () => {
      const { requests } = mockThemesHost();
      const service = createService();

      const asset = await service.getAsset(poster().assetId);
      expect(asset.body.equals(readFixture(poster().path))).toBe(true);
      expect(asset.mediaType).toBe('image/svg+xml');
      await service.getAsset(poster().assetId);
      expect(
        requests.filter((url) => url.endsWith(poster().path)),
      ).toHaveLength(1);
    });

    it('answers 404 for an asset no listed manifest declares, without requesting it', async () => {
      const { requests } = mockThemesHost();
      await expect(
        createService().getAsset('unknown-0123456789abcdef'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(requests.some((url) => url.includes('unknown'))).toBe(false);
    });

    it('makes one upstream request for ten concurrent first requests', async () => {
      const { requests } = mockThemesHost();
      const service = createService();
      const { assetId, path } = fixtureAsset(
        NEW_YEAR_MANIFEST,
        'snowman-delivery.desktop',
      );

      await Promise.all(
        Array.from({ length: 10 }, () => service.getAsset(assetId)),
      );
      expect(requests.filter((url) => url.endsWith(path))).toHaveLength(1);
    });

    it('rejects a Lottie asset deeper than 64 with 502', async () => {
      const deep = Buffer.from(`${'['.repeat(65)}${']'.repeat(65)}`);
      const manifest = readJsonFixture<{
        assets: Record<string, unknown>[];
        scenes: Record<string, unknown>[];
      }>(NEW_YEAR_MANIFEST);
      const hash = sha256(deep);
      const assetId = `new-year-default-deep-${hash.slice(0, 16)}`;
      manifest.assets[0] = {
        ...manifest.assets[0],
        assetId,
        file: 'deep.json',
        bytes: deep.length,
        sha256: hash,
      };
      manifest.scenes[0].variants = [{ when: {}, animationAssetId: assetId }];
      mockThemesHost({
        ...indexWithManifest(NEW_YEAR_MANIFEST, manifest),
        'new-year-default/1.0.0/deep.json': deep,
      });

      await expect(createService().getAsset(assetId)).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('reports an outage instead of an unknown asset', async () => {
      mockThemesHost({
        [NEW_YEAR_MANIFEST]: new TypeError('fetch failed'),
        [ANNIVERSARY_MANIFEST]: new TypeError('fetch failed'),
      });
      await expect(
        createService().getAsset(poster().assetId),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('getEncodedAsset', () => {
    it('compresses an asset once per encoding', async () => {
      mockThemesHost();
      const service = createService();
      const { assetId } = fixtureAsset(
        NEW_YEAR_MANIFEST,
        'snowman-delivery.desktop',
      );
      const asset = await service.getAsset(assetId);

      const first = await service.getEncodedAsset(
        assetId,
        asset,
        CelebrationContentEncoding.Brotli,
      );
      const second = await service.getEncodedAsset(
        assetId,
        asset,
        CelebrationContentEncoding.Brotli,
      );
      expect(second).toBe(first);
      expect(asset.encodings.size).toBe(1);
    });
  });
});

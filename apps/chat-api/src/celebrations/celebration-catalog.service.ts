import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Cache } from 'cache-manager';
import {
  celebrationPackKey,
  normalizeCelebrationIndex,
  type IndexedCelebrationPack,
  type NormalizedCelebrationIndex,
} from './celebration-index.normalizer';
import {
  normalizeCelebrationManifest,
  type CelebrationAssetFile,
  type NormalizedCelebrationManifest,
} from './celebration-manifest.normalizer';
import type { CelebrationNormalization } from './celebration-values';
import { CelebrationsUpstreamReader } from './celebrations-upstream.reader';
import {
  CELEBRATION_ASSET_MAX_BYTES,
  CELEBRATION_INDEX_CACHE_KEY,
  CELEBRATION_INDEX_MAX_BYTES,
  CELEBRATION_INDEX_MAX_DEPTH,
  CELEBRATION_INDEX_PATH,
  CELEBRATION_INDEX_TTL_MS,
  CELEBRATION_LOTTIE_MAX_DEPTH,
  CELEBRATION_MANIFEST_MAX_BYTES,
  CELEBRATION_MANIFEST_MAX_DEPTH,
  IMMUTABLE_BROTLI_QUALITY,
  celebrationAssetStoreKey,
  celebrationManifestStoreKey,
} from './constants/celebrations.constants';
import type { CelebrationCatalogDto } from './dto/celebration-catalog.dto';
import type { CelebrationPackDto } from './dto/celebration-pack.dto';
import { ImmutableResourceStore } from './immutable-resource.store';
import { parseBoundedJson } from './json-depth';
import { compressCelebrationBody } from './response-encoding';
import {
  type CelebrationContentEncoding,
  CelebrationMediaType,
  CelebrationResourceKind,
} from './types/celebration';

/** A validated manifest as stored, with the hash it was verified against. */
interface StoredCelebrationManifest extends NormalizedCelebrationManifest {
  sha256: string;
}

/** Verified asset bytes and their lazily created compressed copies. */
export interface StoredCelebrationAsset {
  /** Identity bytes; `sha256` and `bytes` describe these. */
  body: Buffer;
  /** Declared media type, served as `Content-Type`. */
  mediaType: CelebrationMediaType;
  /** Compressed copies, created on first request and counted by the store. */
  encodings: Map<CelebrationContentEncoding, Promise<Buffer>>;
}

/**
 * Serves the celebration catalog, pack manifests and assets from
 * `<THEMES_CONFIG_URL>/celebrations/`. The mutable index lives 60 s in the
 * shared app cache, with the last valid revision kept for an invalid refetch;
 * manifests and assets live in the byte-bounded immutable store.
 */
@Injectable()
export class CelebrationCatalogService {
  private readonly logger = new Logger(CelebrationCatalogService.name);
  private lastValidIndex: NormalizedCelebrationIndex | undefined;
  private indexLoad: Promise<NormalizedCelebrationIndex> | undefined;
  /* First manifest to declare an asset ID wins; a later one with another hash is rejected. */
  private readonly assetHashes = new Map<string, string>();

  constructor(
    private readonly reader: CelebrationsUpstreamReader,
    private readonly store: ImmutableResourceStore,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Returns the normalized celebration catalog.
   *
   * @throws {NotFoundException} No index is published
   * @throws {BadGatewayException} The index is invalid and no earlier revision was valid
   * @throws {ServiceUnavailableException} The themes host is unset, unreachable or timed out
   */
  async getCatalog(): Promise<CelebrationCatalogDto> {
    return (await this.getIndex()).catalog;
  }

  /**
   * Returns one validated pack version of the current index.
   *
   * @throws {NotFoundException} The index does not list the pack version
   * @throws {BadGatewayException} The manifest fails verification or validation
   * @throws {ServiceUnavailableException} The themes host is unset, unreachable or timed out
   */
  async getPack(packId: string, version: string): Promise<CelebrationPackDto> {
    const index = await this.getIndex();
    const ref = index.packs.find(
      (pack) => pack.packId === packId && pack.version === version,
    );
    if (!ref) {
      throw new NotFoundException('Celebration pack not found');
    }
    const { pack } = await this.getManifest(ref);
    return {
      packId: pack.packId,
      version: pack.version,
      eventId: pack.eventId,
      catalogRevision: index.catalog.revision,
      requiredCapabilities: pack.requiredCapabilities,
      assets: pack.assets,
      labels: pack.labels,
      ...(pack.event ? { event: pack.event } : {}),
      scenes: pack.scenes,
    };
  }

  /**
   * Returns the verified bytes of an asset that a manifest of the current
   * index declares. An unknown ID never reaches the themes host.
   *
   * @throws {NotFoundException} No listed manifest declares the asset
   * @throws {BadGatewayException} The asset fails verification
   * @throws {ServiceUnavailableException} The themes host is unset, unreachable or timed out
   */
  async getAsset(assetId: string): Promise<StoredCelebrationAsset> {
    const file = await this.findAssetFile(assetId);
    if (!file) {
      throw new NotFoundException('Celebration asset not found');
    }
    return this.store.getOrLoad(celebrationAssetStoreKey(assetId), async () => {
      const body = await this.reader.read({
        kind: CelebrationResourceKind.Asset,
        id: assetId,
        path: file.path,
        maxBytes: CELEBRATION_ASSET_MAX_BYTES[file.mediaType],
        expected: {
          bytes: file.bytes,
          sha256: file.sha256,
          mediaType: file.mediaType,
        },
      });
      if (file.mediaType === CelebrationMediaType.Json) {
        this.parse(
          body,
          CELEBRATION_LOTTIE_MAX_DEPTH,
          CelebrationResourceKind.Asset,
          assetId,
          (value) => ({ value }),
        );
      }
      return {
        value: { body, mediaType: file.mediaType, encodings: new Map() },
        bytes: body.length,
      };
    });
  }

  /**
   * Returns the asset compressed with `encoding`, compressing it once at
   * Brotli 11 / gzip 9. The copy is kept only while the store can count it.
   */
  async getEncodedAsset(
    assetId: string,
    asset: StoredCelebrationAsset,
    encoding: CelebrationContentEncoding,
  ): Promise<Buffer> {
    const existing = asset.encodings.get(encoding);
    if (existing) return existing;
    const compression = compressCelebrationBody(
      asset.body,
      encoding,
      IMMUTABLE_BROTLI_QUALITY,
    );
    asset.encodings.set(encoding, compression);
    try {
      const encoded = await compression;
      if (!this.store.grow(celebrationAssetStoreKey(assetId), encoded.length)) {
        asset.encodings.delete(encoding);
      }
      return encoded;
    } catch (error) {
      asset.encodings.delete(encoding);
      throw error;
    }
  }

  private async getIndex(): Promise<NormalizedCelebrationIndex> {
    const cached = await this.cacheManager.get<NormalizedCelebrationIndex>(
      CELEBRATION_INDEX_CACHE_KEY,
    );
    if (cached) return cached;
    this.indexLoad ??= this.loadIndex().finally(() => {
      this.indexLoad = undefined;
    });
    return this.indexLoad;
  }

  private async loadIndex(): Promise<NormalizedCelebrationIndex> {
    let index: NormalizedCelebrationIndex;
    try {
      const body = await this.reader.read({
        kind: CelebrationResourceKind.Index,
        id: CELEBRATION_INDEX_PATH,
        path: CELEBRATION_INDEX_PATH,
        maxBytes: CELEBRATION_INDEX_MAX_BYTES,
      });
      index = this.parse(
        body,
        CELEBRATION_INDEX_MAX_DEPTH,
        CelebrationResourceKind.Index,
        CELEBRATION_INDEX_PATH,
        (value) =>
          normalizeCelebrationIndex(value, (message) =>
            this.logger.warn(message),
          ),
      );
    } catch (error) {
      if (!(error instanceof BadGatewayException) || !this.lastValidIndex) {
        throw error;
      }
      this.logger.warn(
        `Serving celebration index revision ${this.lastValidIndex.catalog.revision} after an invalid refetch`,
      );
      index = this.lastValidIndex;
    }
    /* Cached for the TTL either way, so an invalid upstream is refetched at most once per minute. */
    await this.cacheManager.set(
      CELEBRATION_INDEX_CACHE_KEY,
      index,
      CELEBRATION_INDEX_TTL_MS,
    );
    this.lastValidIndex = index;
    return index;
  }

  private async getManifest(
    ref: IndexedCelebrationPack,
  ): Promise<StoredCelebrationManifest> {
    const id = celebrationPackKey(ref);
    const manifest = await this.store.getOrLoad(
      celebrationManifestStoreKey(ref.packId, ref.version),
      async () => {
        const body = await this.reader.read({
          kind: CelebrationResourceKind.Manifest,
          id,
          path: ref.manifest.path,
          maxBytes: CELEBRATION_MANIFEST_MAX_BYTES,
          expected: { bytes: ref.manifest.bytes, sha256: ref.manifest.sha256 },
        });
        const normalized = this.parse(
          body,
          CELEBRATION_MANIFEST_MAX_DEPTH,
          CelebrationResourceKind.Manifest,
          id,
          (value) => normalizeCelebrationManifest(value, ref),
        );
        this.claimAssetIds(id, normalized.files);
        return {
          value: { ...normalized, sha256: ref.manifest.sha256 },
          bytes: body.length,
        };
      },
    );
    /* A version is immutable: a new hash under a stored version is a republish. */
    if (manifest.sha256 !== ref.manifest.sha256) {
      this.logger.warn(
        `Rejected celebration manifest ${id}: hash differs from the stored version`,
      );
      throw new BadGatewayException('Celebration resource is invalid');
    }
    return manifest;
  }

  private claimAssetIds(
    manifestId: string,
    files: Map<string, CelebrationAssetFile>,
  ): void {
    for (const { assetId, sha256 } of files.values()) {
      const claimed = this.assetHashes.get(assetId);
      if (claimed !== undefined && claimed !== sha256) {
        this.logger.warn(
          `Rejected celebration manifest ${manifestId}: asset ${assetId} collides with a different sha256`,
        );
        throw new BadGatewayException('Celebration resource is invalid');
      }
    }
    for (const { assetId, sha256 } of files.values()) {
      this.assetHashes.set(assetId, sha256);
    }
  }

  private async findAssetFile(
    assetId: string,
  ): Promise<CelebrationAssetFile | undefined> {
    const index = await this.getIndex();
    const manifests = await Promise.allSettled(
      index.packs.map((ref) => this.getManifest(ref)),
    );
    for (const result of manifests) {
      const file =
        result.status === 'fulfilled'
          ? result.value.files.get(assetId)
          : undefined;
      if (file) return file;
    }
    /* An invalid or missing manifest only hides its own assets; an outage is
     * reported as one rather than as an unknown asset. */
    const outage = manifests.find(
      (result) =>
        result.status === 'rejected' &&
        result.reason instanceof ServiceUnavailableException,
    );
    if (outage?.status === 'rejected') throw outage.reason;
    return undefined;
  }

  private parse<T>(
    body: Buffer,
    maxDepth: number,
    kind: CelebrationResourceKind,
    id: string,
    normalize: (value: unknown) => CelebrationNormalization<T>,
  ): T {
    const parsed = parseBoundedJson(body, maxDepth);
    const result = 'error' in parsed ? parsed : normalize(parsed.value);
    if ('error' in result) {
      this.logger.warn(`Rejected celebration ${kind} ${id}: ${result.error}`);
      throw new BadGatewayException('Celebration resource is invalid');
    }
    return result.value;
  }
}

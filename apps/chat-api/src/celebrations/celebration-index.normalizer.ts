import {
  CelebrationNormalization,
  isCelebrationId,
  isIntegerInRange,
  isMatching,
  isRecord,
} from './celebration-values';
import {
  CELEBRATION_MANIFEST_MAX_BYTES,
  CELEBRATION_REVISION_PATTERN,
  CELEBRATION_SCHEMA_VERSION,
  CELEBRATION_SHA256_PATTERN,
  CELEBRATION_VERSION_PATTERN,
} from './constants/celebrations.constants';
import type {
  CelebrationCatalogDto,
  CelebrationCatalogPackDto,
  CelebrationPackRefDto,
} from './dto/celebration-catalog.dto';

/** Where a pack's manifest lives upstream and what it must hash to. Never sent to clients. */
export interface CelebrationManifestRef {
  /** Path relative to the celebrations directory. */
  path: string;
  /** Exact byte length. */
  bytes: number;
  /** Lowercase hex SHA-256. */
  sha256: string;
}

/** A listed pack together with its server-side manifest reference. */
export interface IndexedCelebrationPack extends CelebrationCatalogPackDto {
  /** Upstream manifest reference. */
  manifest: CelebrationManifestRef;
}

/** A validated celebration index: the public catalog and the private manifest references. */
export interface NormalizedCelebrationIndex {
  /** What `GET /api/v1/celebrations` returns. */
  catalog: CelebrationCatalogDto;
  /** Every listed pack, in index order. */
  packs: IndexedCelebrationPack[];
}

/** Returns the `packId@version` key that identifies one pack version. */
export const celebrationPackKey = ({
  packId,
  version,
}: CelebrationPackRefDto) => `${packId}@${version}`;

const normalizePack = (
  raw: unknown,
  index: number,
): CelebrationNormalization<IndexedCelebrationPack> => {
  if (!isRecord(raw)) return { error: `packs[${index}] is not an object` };
  const { packId, version, eventId, manifest } = raw;
  if (!isCelebrationId(packId) || !isCelebrationId(eventId)) {
    return { error: `packs[${index}] has an invalid packId or eventId` };
  }
  if (!isMatching(version, CELEBRATION_VERSION_PATTERN)) {
    return { error: `packs[${index}].version is not MAJOR.MINOR.PATCH` };
  }
  if (
    !isRecord(manifest) ||
    typeof manifest.path !== 'string' ||
    !isIntegerInRange(manifest.bytes, 1, CELEBRATION_MANIFEST_MAX_BYTES) ||
    !isMatching(manifest.sha256, CELEBRATION_SHA256_PATTERN)
  ) {
    return { error: `packs[${index}].manifest is invalid` };
  }
  /* The path is kept as published: the reader rejects one that leaves the
   * celebrations directory, which makes only that pack unavailable. */
  return {
    value: {
      packId,
      version,
      eventId,
      manifest: {
        path: manifest.path,
        bytes: manifest.bytes,
        sha256: manifest.sha256,
      },
    },
  };
};

const normalizeDefaults = (
  raw: unknown,
  packs: IndexedCelebrationPack[],
  warn: (message: string) => void,
): Record<string, CelebrationPackRefDto> => {
  const defaults: Record<string, CelebrationPackRefDto> = {};
  if (raw === undefined) return defaults;
  if (!isRecord(raw)) {
    warn('Celebration index defaults is not an object; ignoring it');
    return defaults;
  }
  for (const [eventId, ref] of Object.entries(raw)) {
    const pack =
      isCelebrationId(eventId) && isRecord(ref)
        ? packs.find(
            (candidate) =>
              candidate.packId === ref.packId &&
              candidate.version === ref.version,
          )
        : undefined;
    if (!pack || pack.eventId !== eventId) {
      warn(
        `Dropping celebration default for ${eventId}: it names no listed pack of that event`,
      );
      continue;
    }
    defaults[eventId] = { packId: pack.packId, version: pack.version };
  }
  return defaults;
};

/**
 * Normalizes the published `celebrations/index.json` into the catalog DTO
 * plus the manifest references. Only allowlisted fields pass. A default that
 * names an unlisted pack, or a pack of another event, is dropped with a
 * warning; a duplicate pack version, an invalid ID or an unsupported
 * `schemaVersion` rejects the whole index.
 */
export const normalizeCelebrationIndex = (
  raw: unknown,
  warn: (message: string) => void,
): CelebrationNormalization<NormalizedCelebrationIndex> => {
  if (!isRecord(raw)) return { error: 'index is not an object' };
  if (raw.schemaVersion !== CELEBRATION_SCHEMA_VERSION) {
    return { error: `unsupported schemaVersion ${String(raw.schemaVersion)}` };
  }
  if (!isMatching(raw.revision, CELEBRATION_REVISION_PATTERN)) {
    return { error: 'revision is invalid' };
  }
  if (!Array.isArray(raw.packs)) return { error: 'packs is not an array' };

  const packs: IndexedCelebrationPack[] = [];
  const keys = new Set<string>();
  for (const [index, entry] of raw.packs.entries()) {
    const result = normalizePack(entry, index);
    if ('error' in result) return result;
    const key = celebrationPackKey(result.value);
    if (keys.has(key)) return { error: `${key} is listed twice` };
    keys.add(key);
    packs.push(result.value);
  }

  return {
    value: {
      catalog: {
        schemaVersion: CELEBRATION_SCHEMA_VERSION,
        revision: raw.revision,
        packs: packs.map(({ packId, version, eventId }) => ({
          packId,
          version,
          eventId,
        })),
        defaults: normalizeDefaults(raw.defaults, packs, warn),
      },
      packs,
    },
  };
};

import type { IndexedCelebrationPack } from './celebration-index.normalizer';
import {
  CelebrationNormalization,
  isCelebrationId,
  isEnumValue,
  isIntegerInRange,
  isMatching,
  isRecord,
} from './celebration-values';
import {
  CELEBRATION_ASSET_ID_PATTERN,
  CELEBRATION_ASSET_MAX_BYTES,
  CELEBRATION_CAPABILITY_PATTERN,
  CELEBRATION_LABEL_ID_PATTERN,
  CELEBRATION_LOCALE_PATTERN,
  CELEBRATION_MAX_ASSETS,
  CELEBRATION_MAX_CAPABILITIES,
  CELEBRATION_MAX_LABEL_LENGTH,
  CELEBRATION_MAX_LIFETIME_MS,
  CELEBRATION_MAX_LOAD_TIMEOUT_MS,
  CELEBRATION_MAX_LOCALES,
  CELEBRATION_MAX_READY_TIMEOUT_MS,
  CELEBRATION_MAX_SCENES,
  CELEBRATION_MAX_VARIANTS,
  CELEBRATION_MIN_POSTER_DURATION_MS,
  CELEBRATION_SCHEMA_VERSION,
  CELEBRATION_SHA256_PATTERN,
  STATIC_TRIGGER_TEMPLATE,
  VIEWPORT_STAGE_TEMPLATE,
} from './constants/celebrations.constants';
import type {
  CelebrationAssetDto,
  CelebrationEventDto,
  CelebrationPackDto,
  CelebrationPlacementDto,
  CelebrationSceneDto,
  CelebrationTimingDto,
  CelebrationVariantConditionsDto,
  CelebrationVariantDto,
} from './dto/celebration-pack.dto';
import {
  CelebrationMediaType,
  CelebrationSceneDirection,
  CelebrationStageAlign,
  CelebrationStageFit,
  CelebrationVariantColorScheme,
  CelebrationVariantDirection,
  CelebrationVariantLayout,
} from './types/celebration';

const SHA256_PREFIX_LENGTH = 16;
const PHRASE_PLACEHOLDER = /\{\{phrase\}\}/g;

/** A declared asset together with its upstream path. The path is never sent to clients. */
export interface CelebrationAssetFile extends CelebrationAssetDto {
  /** Path relative to the celebrations directory. */
  path: string;
}

/** A validated manifest: the pack without `catalogRevision`, and its asset files. */
export interface NormalizedCelebrationManifest {
  /** The client-facing pack; `catalogRevision` is added per response. */
  pack: Omit<CelebrationPackDto, 'catalogRevision'>;
  /** Declared assets by asset ID. */
  files: Map<string, CelebrationAssetFile>;
}

type Labels = CelebrationPackDto['labels'];

/* Every check throws this, so one manifest rule reads as one line; the
 * exported normalizer turns it back into `{ error }`. */
class ManifestRejection extends Error {}

const reject = (message: string): never => {
  throw new ManifestRejection(message);
};

const requireThat = (condition: boolean, message: string) => {
  if (!condition) reject(message);
};

const readCapabilities = (raw: unknown, path: string): string[] => {
  requireThat(
    Array.isArray(raw) &&
      raw.length <= CELEBRATION_MAX_CAPABILITIES &&
      raw.every((id) => isMatching(id, CELEBRATION_CAPABILITY_PATTERN)),
    `${path} is not a list of capability IDs`,
  );
  return [...(raw as string[])];
};

const readAssets = (
  raw: unknown,
  directory: string,
): Map<string, CelebrationAssetFile> => {
  requireThat(
    Array.isArray(raw) && raw.length <= CELEBRATION_MAX_ASSETS,
    `assets must list at most ${CELEBRATION_MAX_ASSETS} entries`,
  );
  const files = new Map<string, CelebrationAssetFile>();
  for (const [index, entry] of (raw as unknown[]).entries()) {
    const path = `assets[${index}]`;
    requireThat(isRecord(entry), `${path} is not an object`);
    const { assetId, file, mediaType, bytes, sha256 } = entry as Record<
      string,
      unknown
    >;
    requireThat(
      isMatching(assetId, CELEBRATION_ASSET_ID_PATTERN),
      `${path}.assetId is invalid`,
    );
    requireThat(!files.has(assetId as string), `${path} repeats ${assetId}`);
    requireThat(
      isEnumValue(CelebrationMediaType, mediaType),
      `${path}.mediaType is not allowed`,
    );
    const cap = CELEBRATION_ASSET_MAX_BYTES[mediaType as CelebrationMediaType];
    requireThat(
      isIntegerInRange(bytes, 1, cap),
      `${path}.bytes exceeds ${cap}`,
    );
    requireThat(
      isMatching(sha256, CELEBRATION_SHA256_PATTERN),
      `${path}.sha256 is not lowercase hex SHA-256`,
    );
    requireThat(
      (assetId as string).endsWith(
        (sha256 as string).slice(0, SHA256_PREFIX_LENGTH),
      ),
      `${path}.assetId does not end with its sha256 prefix`,
    );
    requireThat(
      typeof file === 'string' && file.length > 0,
      `${path}.file is missing`,
    );
    files.set(assetId as string, {
      assetId: assetId as string,
      mediaType: mediaType as CelebrationMediaType,
      bytes: bytes as number,
      sha256: sha256 as string,
      path: `${directory}${file as string}`,
    });
  }
  return files;
};

const readLabels = (raw: unknown): Labels => {
  const labels: Labels = {};
  if (raw === undefined) return labels;
  requireThat(isRecord(raw), 'labels is not an object');
  const locales = Object.entries(raw as Record<string, unknown>);
  requireThat(
    locales.length <= CELEBRATION_MAX_LOCALES,
    `labels has more than ${CELEBRATION_MAX_LOCALES} locales`,
  );
  requireThat(
    locales.length === 0 || 'en' in (raw as object),
    'labels lacks en',
  );
  for (const [locale, entries] of locales) {
    requireThat(
      isMatching(locale, CELEBRATION_LOCALE_PATTERN) && isRecord(entries),
      `labels.${locale} is invalid`,
    );
    const texts: Record<string, string> = {};
    for (const [labelId, text] of Object.entries(entries as object)) {
      requireThat(
        isMatching(labelId, CELEBRATION_LABEL_ID_PATTERN) &&
          typeof text === 'string' &&
          text.length <= CELEBRATION_MAX_LABEL_LENGTH &&
          !text.replace(PHRASE_PLACEHOLDER, '').includes('{{'),
        `labels.${locale}.${labelId} is invalid`,
      );
      texts[labelId] = text as string;
    }
    labels[locale] = texts;
  }
  return labels;
};

const readPlacement = (raw: unknown, path: string): CelebrationPlacementDto => {
  requireThat(
    isRecord(raw) && isCelebrationId((raw as Record<string, unknown>).template),
    `${path}.template is invalid`,
  );
  const { template, fit, align } = raw as Record<string, unknown>;
  /* Other templates (composer-anchor-v1 from S3) are passed as the ID alone;
   * the scene requires their capability, so a client without it skips it. */
  if (template !== VIEWPORT_STAGE_TEMPLATE)
    return { template: template as string };
  requireThat(isEnumValue(CelebrationStageFit, fit), `${path}.fit is invalid`);
  requireThat(
    isEnumValue(CelebrationStageAlign, align),
    `${path}.align is invalid`,
  );
  return {
    template,
    fit: fit as CelebrationStageFit,
    align: align as CelebrationStageAlign,
  };
};

const readTiming = (raw: unknown, path: string): CelebrationTimingDto => {
  requireThat(isRecord(raw), `${path}.timing is not an object`);
  const { playbackDurationMs, loadTimeoutMs, readyTimeoutMs, maxLifetimeMs } =
    raw as Record<string, unknown>;
  requireThat(
    isIntegerInRange(playbackDurationMs, 1, CELEBRATION_MAX_LIFETIME_MS) &&
      isIntegerInRange(loadTimeoutMs, 1, CELEBRATION_MAX_LOAD_TIMEOUT_MS) &&
      isIntegerInRange(readyTimeoutMs, 1, CELEBRATION_MAX_READY_TIMEOUT_MS) &&
      isIntegerInRange(maxLifetimeMs, 1, CELEBRATION_MAX_LIFETIME_MS),
    `${path}.timing is out of bounds`,
  );
  const timing = {
    playbackDurationMs: playbackDurationMs as number,
    loadTimeoutMs: loadTimeoutMs as number,
    readyTimeoutMs: readyTimeoutMs as number,
    maxLifetimeMs: maxLifetimeMs as number,
  };
  requireThat(
    timing.maxLifetimeMs >=
      timing.loadTimeoutMs + timing.readyTimeoutMs + timing.playbackDurationMs,
    `${path}.timing.maxLifetimeMs is shorter than load + ready + playback`,
  );
  return timing;
};

const readConditions = (
  raw: unknown,
  path: string,
): CelebrationVariantConditionsDto => {
  requireThat(isRecord(raw), `${path}.when is not an object`);
  const conditions: CelebrationVariantConditionsDto = {};
  /* An unknown condition is a rejection, not a stripped field: dropping it
   * would let the variant match hosts it was not authored for. */
  for (const [key, value] of Object.entries(raw as object)) {
    if (key === 'layout' && isEnumValue(CelebrationVariantLayout, value)) {
      conditions.layout = value;
    } else if (
      key === 'direction' &&
      isEnumValue(CelebrationVariantDirection, value)
    ) {
      conditions.direction = value;
    } else if (
      key === 'colorScheme' &&
      isEnumValue(CelebrationVariantColorScheme, value)
    ) {
      conditions.colorScheme = value;
    } else {
      reject(`${path}.when.${key} is not a v1 condition`);
    }
  }
  return conditions;
};

const readScene = (
  raw: unknown,
  index: number,
  files: Map<string, CelebrationAssetFile>,
): CelebrationSceneDto => {
  const path = `scenes[${index}]`;
  requireThat(isRecord(raw), `${path} is not an object`);
  const scene = raw as Record<string, unknown>;
  requireThat(isCelebrationId(scene.id), `${path}.id is invalid`);
  requireThat(
    isMatching(scene.labelId, CELEBRATION_LABEL_ID_PATTERN),
    `${path}.labelId is invalid`,
  );
  requireThat(
    isMatching(scene.renderer, CELEBRATION_CAPABILITY_PATTERN),
    `${path}.renderer is invalid`,
  );
  requireThat(
    isEnumValue(CelebrationSceneDirection, scene.direction),
    `${path}.direction is invalid`,
  );
  const timing = readTiming(scene.timing, path);
  requireThat(
    isIntegerInRange(
      scene.posterDurationMs,
      CELEBRATION_MIN_POSTER_DURATION_MS,
      timing.maxLifetimeMs,
    ),
    `${path}.posterDurationMs is outside 1000..maxLifetimeMs`,
  );
  requireThat(
    files.has(scene.posterAssetId as string),
    `${path}.posterAssetId is not a declared asset`,
  );
  requireThat(
    Array.isArray(scene.variants) &&
      scene.variants.length >= 1 &&
      scene.variants.length <= CELEBRATION_MAX_VARIANTS,
    `${path} needs 1–${CELEBRATION_MAX_VARIANTS} variants`,
  );
  const variants = (scene.variants as unknown[]).map(
    (variant, variantIndex): CelebrationVariantDto => {
      const variantPath = `${path}.variants[${variantIndex}]`;
      requireThat(isRecord(variant), `${variantPath} is not an object`);
      const { when, animationAssetId } = variant as Record<string, unknown>;
      requireThat(
        files.get(animationAssetId as string)?.mediaType ===
          CelebrationMediaType.Json,
        `${variantPath}.animationAssetId is not a declared JSON asset`,
      );
      return {
        when: readConditions(when ?? {}, variantPath),
        animationAssetId: animationAssetId as string,
      };
    },
  );
  return {
    id: scene.id as string,
    labelId: scene.labelId as string,
    renderer: scene.renderer as string,
    requiredCapabilities: readCapabilities(
      scene.requiredCapabilities,
      `${path}.requiredCapabilities`,
    ),
    placement: readPlacement(scene.placement, `${path}.placement`),
    direction: scene.direction as CelebrationSceneDirection,
    timing,
    posterAssetId: scene.posterAssetId as string,
    posterDurationMs: scene.posterDurationMs as number,
    variants,
  };
};

const readEvent = (
  raw: unknown,
  sceneIds: Set<string>,
  files: Map<string, CelebrationAssetFile>,
  labels: Labels,
): CelebrationEventDto => {
  requireThat(isRecord(raw), 'event is not an object');
  const { titleLabelId, clickSceneIds, iconAssetId, decoration } =
    raw as Record<string, unknown>;
  /* An external-only event has no bundled strings, so its labels must exist. */
  const hasEnglishLabel = (labelId: unknown) =>
    typeof labelId === 'string' &&
    labels.en !== undefined &&
    Object.hasOwn(labels.en, labelId);
  requireThat(
    hasEnglishLabel(titleLabelId),
    'event.titleLabelId has no en label',
  );
  requireThat(
    Array.isArray(clickSceneIds) &&
      clickSceneIds.length > 0 &&
      clickSceneIds.every((id) => sceneIds.has(id as string)),
    'event.clickSceneIds must list declared scenes',
  );
  requireThat(
    iconAssetId === undefined || files.has(iconAssetId as string),
    'event.iconAssetId is not a declared asset',
  );
  requireThat(isRecord(decoration), 'event.decoration is not an object');
  const { template, posterAssetId, labelId } = decoration as Record<
    string,
    unknown
  >;
  requireThat(
    template === STATIC_TRIGGER_TEMPLATE,
    `event.decoration.template must be ${STATIC_TRIGGER_TEMPLATE}`,
  );
  requireThat(
    files.has(posterAssetId as string),
    'event.decoration.posterAssetId is not a declared asset',
  );
  requireThat(
    hasEnglishLabel(labelId),
    'event.decoration.labelId has no en label',
  );
  return {
    titleLabelId: titleLabelId as string,
    clickSceneIds: [...(clickSceneIds as string[])],
    ...(iconAssetId === undefined
      ? {}
      : { iconAssetId: iconAssetId as string }),
    decoration: {
      template: STATIC_TRIGGER_TEMPLATE,
      posterAssetId: posterAssetId as string,
      labelId: labelId as string,
    },
  };
};

const readManifest = (
  raw: unknown,
  ref: IndexedCelebrationPack,
): NormalizedCelebrationManifest => {
  requireThat(isRecord(raw), 'manifest is not an object');
  const manifest = raw as Record<string, unknown>;
  requireThat(
    manifest.schemaVersion === CELEBRATION_SCHEMA_VERSION,
    `unsupported schemaVersion ${String(manifest.schemaVersion)}`,
  );
  requireThat(
    manifest.packId === ref.packId &&
      manifest.version === ref.version &&
      manifest.eventId === ref.eventId,
    'packId, version or eventId differs from the index',
  );
  const directory = ref.manifest.path.slice(
    0,
    ref.manifest.path.lastIndexOf('/') + 1,
  );
  const files = readAssets(manifest.assets, directory);
  const labels = readLabels(manifest.labels);
  requireThat(
    Array.isArray(manifest.scenes) &&
      manifest.scenes.length <= CELEBRATION_MAX_SCENES,
    `scenes must list at most ${CELEBRATION_MAX_SCENES} entries`,
  );
  const scenes = (manifest.scenes as unknown[]).map((scene, index) =>
    readScene(scene, index, files),
  );
  const sceneIds = new Set(scenes.map(({ id }) => id));
  requireThat(sceneIds.size === scenes.length, 'scenes repeat an ID');

  return {
    pack: {
      packId: ref.packId,
      version: ref.version,
      eventId: ref.eventId,
      requiredCapabilities: readCapabilities(
        manifest.requiredCapabilities,
        'requiredCapabilities',
      ),
      assets: [...files.values()].map(
        ({ assetId, mediaType, bytes, sha256 }) => ({
          assetId,
          mediaType,
          bytes,
          sha256,
        }),
      ),
      labels,
      ...(manifest.event === undefined
        ? {}
        : { event: readEvent(manifest.event, sceneIds, files, labels) }),
      scenes,
    },
    files,
  };
};

/**
 * Validates a published pack manifest against its index entry and the v1
 * rules: schema version, identity, ID formats, declared asset references,
 * timing bounds, counts and label caps. Only allowlisted fields pass, and
 * asset `file` paths stay server-side.
 *
 * Whether an `event` block is allowed for an event is not checked here: only
 * the client knows its compiled events.
 */
export const normalizeCelebrationManifest = (
  raw: unknown,
  ref: IndexedCelebrationPack,
): CelebrationNormalization<NormalizedCelebrationManifest> => {
  try {
    return { value: readManifest(raw, ref) };
  } catch (error) {
    if (error instanceof ManifestRejection) return { error: error.message };
    throw error;
  }
};

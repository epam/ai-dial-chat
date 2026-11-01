import { CelebrationMediaType } from '../types/celebration';

const KIB = 1024;

/** `eventId`, `packId` and scene IDs: lowercase kebab-case, at most 64 characters. */
export const CELEBRATION_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
export const CELEBRATION_ID_MAX_LENGTH = 64;
/** Strict semver without pre-release or build metadata. */
export const CELEBRATION_VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const CELEBRATION_ASSET_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,95}$/;
export const CELEBRATION_LABEL_ID_PATTERN = /^[a-z][A-Za-z0-9]{0,63}$/;
export const CELEBRATION_REVISION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
export const CELEBRATION_SHA256_PATTERN = /^[0-9a-f]{64}$/;
/** A BCP 47 tag in the simple `language[-subtag]*` form packs use. */
export const CELEBRATION_LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
/** Capability and renderer IDs such as `lottie-light-svg-v1`. */
export const CELEBRATION_CAPABILITY_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
/** One segment of a stored upstream path: no `..`, `\`, `:`, `%` or empty segment. */
export const CELEBRATION_PATH_SEGMENT_PATTERN =
  /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

export const CELEBRATION_SCHEMA_VERSION = 1;
export const CELEBRATION_INDEX_PATH = 'index.json';
/** Directory under `THEMES_CONFIG_URL` that holds every celebration resource. */
export const CELEBRATIONS_UPSTREAM_DIRECTORY = 'celebrations/';

export const CELEBRATION_INDEX_MAX_BYTES = 64 * KIB;
export const CELEBRATION_MANIFEST_MAX_BYTES = 64 * KIB;
export const CELEBRATION_INDEX_MAX_DEPTH = 32;
export const CELEBRATION_MANIFEST_MAX_DEPTH = 32;
export const CELEBRATION_LOTTIE_MAX_DEPTH = 64;

/** Largest accepted asset per declared media type. */
export const CELEBRATION_ASSET_MAX_BYTES: Record<CelebrationMediaType, number> =
  {
    [CelebrationMediaType.Json]: 300 * KIB,
    [CelebrationMediaType.Svg]: 100 * KIB,
    [CelebrationMediaType.Png]: 100 * KIB,
    [CelebrationMediaType.Webp]: 100 * KIB,
  };

export const CELEBRATION_MAX_ASSETS = 32;
export const CELEBRATION_MAX_SCENES = 16;
export const CELEBRATION_MAX_VARIANTS = 8;
export const CELEBRATION_MAX_LOCALES = 16;
export const CELEBRATION_MAX_LABEL_LENGTH = 280;
export const CELEBRATION_MAX_CAPABILITIES = 16;

export const CELEBRATION_MAX_LOAD_TIMEOUT_MS = 2000;
export const CELEBRATION_MAX_READY_TIMEOUT_MS = 250;
export const CELEBRATION_MAX_LIFETIME_MS = 32_000;
export const CELEBRATION_MIN_POSTER_DURATION_MS = 1000;

export const VIEWPORT_STAGE_TEMPLATE = 'viewport-stage-v1';
export const STATIC_TRIGGER_TEMPLATE = 'static-trigger-v1';

export const CELEBRATION_INDEX_CACHE_KEY = 'celebrations:v1:index';
export const CELEBRATION_INDEX_TTL_MS = 60_000;
export const celebrationManifestStoreKey = (packId: string, version: string) =>
  `celebrations:v1:manifest:${packId}:${version}`;
export const celebrationAssetStoreKey = (assetId: string) =>
  `celebrations:v1:asset:${assetId}`;

/** Total bytes, compressed copies included, the immutable resource store may hold. */
export const IMMUTABLE_STORE_MAX_TOTAL_BYTES = 16 * 1024 * KIB;
/** Largest identity body the immutable resource store accepts, the largest resource cap. */
export const IMMUTABLE_STORE_MAX_ENTRY_BYTES = 300 * KIB;

export const CELEBRATION_INDEX_CACHE_CONTROL =
  'public, max-age=60, must-revalidate';
export const CELEBRATION_IMMUTABLE_CACHE_CONTROL =
  'public, max-age=31536000, immutable';
/* Same policy `GET /api/themes/icon` sends for SVG: an SVG opened directly from
 * this origin is an active document, so it may not run scripts or load anything. */
export const CELEBRATION_SVG_CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'unsafe-inline'; sandbox";

/** Brotli quality for immutable resources, compressed once and stored. */
export const IMMUTABLE_BROTLI_QUALITY = 11;
/** Brotli quality for per-response bodies (the index and manifests). */
export const PER_RESPONSE_BROTLI_QUALITY = 5;
export const GZIP_LEVEL = 9;

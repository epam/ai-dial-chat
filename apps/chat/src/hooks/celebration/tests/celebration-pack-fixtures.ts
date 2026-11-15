import {
  CelebrationDeliveryMode,
  CelebrationMediaType,
  type CelebrationAssetDto,
  type CelebrationCatalogDto,
  type CelebrationDeliveryDto,
  type CelebrationPackDto,
  type CelebrationSceneDto,
} from '@epam/ai-dial-chat-api-client';

/* DTO fixtures in the shape `GET /api/v1/celebrations*` serves, matching the
   BFF fixtures in apps/chat-api/src/celebrations/tests/fixtures/. */

export const SNOWMAN_DESKTOP_ID = 'snowman-delivery.desktop.c574a799b1e315fe';
export const SNOWMAN_MOBILE_ID = 'snowman-delivery.mobile.70baf6daf3401deb';
export const SNOWMAN_POSTER_ID = 'snowman-delivery.poster.01ed8dc1d8e1de9c';
export const COURIERS_DESKTOP_ID =
  'bullfinch-couriers.desktop.47bbc1fe0a779d5a';
export const COURIERS_POSTER_ID = 'bullfinch-couriers.poster.1c64d1d78fc4dcca';
export const CONFETTI_DESKTOP_ID = 'confetti.desktop.cf1f6ca020189cf5';
export const CONFETTI_POSTER_ID = 'confetti.poster.3b611add4d51795b';
export const ANNIVERSARY_ICON_ID = 'icon.2f1699c293a33641';

/** Minimal Lottie JSON with a stage size, as `loadCelebrationAssetJson` resolves it. */
export const ANIMATION_DATA = {
  v: '5.7.0',
  fr: 30,
  ip: 0,
  op: 60,
  w: 400,
  h: 300,
  layers: [],
};

const asset = (
  assetId: string,
  mediaType: CelebrationMediaType,
): CelebrationAssetDto => ({
  assetId,
  mediaType,
  bytes: 1024,
  sha256: '0'.repeat(64),
});

const scene = (
  overrides: Partial<CelebrationSceneDto>,
): CelebrationSceneDto => ({
  id: 'snowman-delivery',
  labelId: 'snowmanDeliveryToastMessage',
  renderer: 'lottie-light-svg-v1',
  requiredCapabilities: ['lottie-light-svg-v1', 'viewport-stage-v1'],
  placement: { template: 'viewport-stage-v1', fit: 'contain', align: 'bottom' },
  direction: 'mirror',
  timing: {
    playbackDurationMs: 12000,
    loadTimeoutMs: 2000,
    readyTimeoutMs: 250,
    maxLifetimeMs: 15000,
  },
  posterAssetId: SNOWMAN_POSTER_ID,
  posterDurationMs: 3000,
  variants: [
    { when: { layout: 'desktop' }, animationAssetId: SNOWMAN_DESKTOP_ID },
    { when: { layout: 'mobile' }, animationAssetId: SNOWMAN_MOBILE_ID },
  ],
  ...overrides,
});

/** The New Year pack: a `snowman-delivery` replacement, a `sleigh` nobody allowlists and an added `bullfinch-couriers`. */
export const newYearPack = (
  overrides: Partial<CelebrationPackDto> = {},
): CelebrationPackDto => ({
  packId: 'new-year-default',
  version: '1.0.0',
  eventId: 'new-year',
  catalogRevision: '2026-11-01.1',
  requiredCapabilities: ['lottie-light-svg-v1'],
  assets: [
    asset(SNOWMAN_DESKTOP_ID, CelebrationMediaType.ApplicationJson),
    asset(SNOWMAN_MOBILE_ID, CelebrationMediaType.ApplicationJson),
    asset(SNOWMAN_POSTER_ID, CelebrationMediaType.ImageSvgxml),
    asset(COURIERS_DESKTOP_ID, CelebrationMediaType.ApplicationJson),
    asset(COURIERS_POSTER_ID, CelebrationMediaType.ImageSvgxml),
  ],
  labels: {
    en: {
      snowmanDeliveryToastMessage: 'Pack snowman text',
      bullfinchCouriersToastMessage: 'Two couriers, one gingerbread star.',
    },
  },
  scenes: [
    scene({}),
    scene({ id: 'sleigh', labelId: 'sleighToastMessage' }),
    scene({
      id: 'bullfinch-couriers',
      labelId: 'bullfinchCouriersToastMessage',
      posterAssetId: COURIERS_POSTER_ID,
      variants: [{ when: {}, animationAssetId: COURIERS_DESKTOP_ID }],
    }),
  ],
  ...overrides,
});

/** The external-only company-anniversary pack. */
export const anniversaryPack = (
  overrides: Partial<CelebrationPackDto> = {},
): CelebrationPackDto => ({
  packId: 'company-anniversary',
  version: '1.0.0',
  eventId: 'company-anniversary',
  catalogRevision: '2026-11-01.1',
  requiredCapabilities: ['lottie-light-svg-v1', 'static-trigger-v1'],
  assets: [
    asset(CONFETTI_DESKTOP_ID, CelebrationMediaType.ApplicationJson),
    asset(CONFETTI_POSTER_ID, CelebrationMediaType.ImageSvgxml),
    asset(ANNIVERSARY_ICON_ID, CelebrationMediaType.ImageSvgxml),
  ],
  labels: {
    en: {
      toastTitle: 'Happy anniversary',
      triggerLabel: 'Celebrate the anniversary',
      confettiToastMessage: 'Confetti for everyone',
    },
    de: { triggerLabel: 'Jubiläum feiern' },
  },
  event: {
    titleLabelId: 'toastTitle',
    clickSceneIds: ['confetti'],
    iconAssetId: ANNIVERSARY_ICON_ID,
    decoration: {
      template: 'static-trigger-v1',
      posterAssetId: ANNIVERSARY_ICON_ID,
      labelId: 'triggerLabel',
    },
  },
  scenes: [
    scene({
      id: 'confetti',
      labelId: 'confettiToastMessage',
      posterAssetId: CONFETTI_POSTER_ID,
      variants: [{ when: {}, animationAssetId: CONFETTI_DESKTOP_ID }],
    }),
  ],
  ...overrides,
});

/** A catalog whose defaults name both fixture packs. */
export const CATALOG: CelebrationCatalogDto = {
  schemaVersion: 1,
  revision: '2026-11-01.1',
  packs: [
    { packId: 'new-year-default', version: '1.0.0', eventId: 'new-year' },
    {
      packId: 'company-anniversary',
      version: '1.0.0',
      eventId: 'company-anniversary',
    },
  ],
  defaults: {
    'new-year': { packId: 'new-year-default', version: '1.0.0' },
    'company-anniversary': { packId: 'company-anniversary', version: '1.0.0' },
  },
};

/** The default policy: every scene bundled. */
export const BUNDLED_DELIVERY: CelebrationDeliveryDto = {
  mode: CelebrationDeliveryMode.Bundled,
  revision: '0',
  externalScenes: [],
  externalEvents: [],
};

/** A policy that replaces the snowman, adds the couriers and admits company-anniversary. */
export const PILOT_DELIVERY: CelebrationDeliveryDto = {
  mode: CelebrationDeliveryMode.PreferExternal,
  revision: '2026-11-15.1',
  externalScenes: [
    { eventId: 'new-year', sceneId: 'snowman-delivery' },
    { eventId: 'new-year', sceneId: 'bullfinch-couriers' },
  ],
  externalEvents: ['company-anniversary'],
};

/** A policy that only adds the couriers, so the bundled snowman stays. */
export const COURIERS_DELIVERY: CelebrationDeliveryDto = {
  ...PILOT_DELIVERY,
  externalScenes: [{ eventId: 'new-year', sceneId: 'bullfinch-couriers' }],
};

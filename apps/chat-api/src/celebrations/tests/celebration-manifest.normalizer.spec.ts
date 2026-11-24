import { describe, expect, it, vi } from 'vitest';
import {
  normalizeCelebrationIndex,
  type IndexedCelebrationPack,
} from '../celebration-index.normalizer';
import { normalizeCelebrationManifest } from '../celebration-manifest.normalizer';
import {
  ANNIVERSARY_MANIFEST,
  NEW_YEAR_MANIFEST,
  readJsonFixture,
} from './celebrations.fixtures';

type Manifest = Record<string, unknown> & {
  assets: Record<string, unknown>[];
  scenes: Record<string, unknown>[];
};

const indexedPacks = (): IndexedCelebrationPack[] => {
  const result = normalizeCelebrationIndex(
    readJsonFixture('index.json'),
    vi.fn(),
  );
  if ('error' in result) throw new Error(result.error);
  return result.value.packs;
};
const newYearRef = () => indexedPacks()[0];
const anniversaryRef = () => indexedPacks()[1];
const newYear = () => readJsonFixture<Manifest>(NEW_YEAR_MANIFEST);
const anniversary = () => readJsonFixture<Manifest>(ANNIVERSARY_MANIFEST);

const withScene = (
  manifest: Manifest,
  override: Record<string, unknown>,
): Manifest => ({
  ...manifest,
  scenes: [{ ...manifest.scenes[0], ...override }],
});

describe('normalizeCelebrationManifest', () => {
  it('returns the pack without file paths and keeps the paths server-side', () => {
    const result = normalizeCelebrationManifest(newYear(), newYearRef());
    if ('error' in result) throw new Error(result.error);

    const { pack, files } = result.value;
    expect(pack).toMatchObject({
      packId: 'new-year-default',
      version: '1.0.0',
      eventId: 'new-year',
      labels: {},
      scenes: [
        {
          id: 'snowman-delivery',
          labelId: 'snowmanDeliveryToastMessage',
          placement: {
            template: 'viewport-stage-v1',
            fit: 'contain',
            align: 'bottom',
          },
          direction: 'mirror',
          timing: { playbackDurationMs: 12000, maxLifetimeMs: 15000 },
        },
      ],
    });
    expect(pack.event).toBeUndefined();
    expect(JSON.stringify(pack)).not.toMatch(/"file"|"path"/);
    expect([...files.values()].map(({ path }) => path)).toEqual(
      newYear().assets.map(
        ({ file }) => `new-year-default/1.0.0/${file as string}`,
      ),
    );
  });

  it('returns the event block and labels of an external-only event', () => {
    const result = normalizeCelebrationManifest(
      anniversary(),
      anniversaryRef(),
    );
    if ('error' in result) throw new Error(result.error);
    expect(result.value.pack.event).toMatchObject({
      titleLabelId: 'toastTitle',
      clickSceneIds: ['confetti'],
      decoration: { template: 'static-trigger-v1', labelId: 'activate' },
    });
    expect(result.value.pack.labels.de).toEqual({
      toastTitle: 'Alles Gute zum Jubiläum!',
    });
  });

  it('strips fields outside the v1 allowlist', () => {
    const manifest = withScene(newYear(), { css: 'body{}', script: 'x()' });
    const result = normalizeCelebrationManifest(
      { ...manifest, routes: ['/admin'] },
      newYearRef(),
    );
    expect(JSON.stringify(result)).not.toMatch(/css|script|routes/);
  });

  const composerAnchor = (override: Record<string, unknown> = {}) => ({
    template: 'composer-anchor-v1',
    anchor: 'composer',
    anchorRect: { x: 340, y: 164, width: 520, height: 56 },
    edge: 'top',
    scale: { min: 0.6, max: 1 },
    fallback: 'stage-anchor',
    ...override,
  });

  it('forwards a valid composer-anchor placement and nothing else', () => {
    const result = normalizeCelebrationManifest(
      withScene(newYear(), {
        placement: { ...composerAnchor(), fit: 'contain', selector: '.x' },
      }),
      newYearRef(),
    );
    if ('error' in result) throw new Error(result.error);
    expect(result.value.pack.scenes[0].placement).toEqual(composerAnchor());
  });

  it.each<[string, Record<string, unknown>]>([
    ['an unknown anchor', { anchor: 'sidebar' }],
    ['edge: left', { edge: 'left' }],
    [
      'a non-finite anchorRect value',
      { anchorRect: { x: 0, y: 0, width: Number.NaN, height: 56 } },
    ],
    ['a missing anchorRect', { anchorRect: undefined }],
    [
      'an anchorRect narrower than 120',
      { anchorRect: { x: 0, y: 0, width: 100, height: 56 } },
    ],
    [
      'an anchorRect shorter than 24',
      { anchorRect: { x: 0, y: 0, width: 520, height: 20 } },
    ],
    ['scale.min above scale.max', { scale: { min: 1.2, max: 1 } }],
    ['scale.min below 0.25', { scale: { min: 0.1, max: 1 } }],
    ['scale.max above 4', { scale: { min: 1, max: 5 } }],
    ['the S0 viewport-stage-v1 fallback', { fallback: 'viewport-stage-v1' }],
  ])('rejects a composer-anchor placement with %s', (_name, override) => {
    const result = normalizeCelebrationManifest(
      withScene(newYear(), { placement: composerAnchor(override) }),
      newYearRef(),
    );
    expect(result).toHaveProperty('error');
  });

  it('forwards a variant placement that keeps the scene template', () => {
    const scene = newYear().scenes[0] as {
      variants: Record<string, unknown>[];
    };
    const mobile = composerAnchor({
      anchorRect: { x: 210, y: 132, width: 300, height: 56 },
      scale: { min: 0.77, max: 1 },
    });
    const result = normalizeCelebrationManifest(
      withScene(newYear(), {
        placement: composerAnchor(),
        variants: [
          scene.variants[0],
          { ...scene.variants[1], placement: mobile },
        ],
      }),
      newYearRef(),
    );
    if ('error' in result) throw new Error(result.error);
    const [desktop, phone] = result.value.pack.scenes[0].variants;
    expect(desktop).not.toHaveProperty('placement');
    expect(phone.placement).toEqual(mobile);
  });

  it('forwards a cat-borrow scene unchanged and keeps its animation opaque', () => {
    const manifest = newYear();
    const scene = manifest.scenes[0] as {
      variants: Record<string, unknown>[];
    };
    const catBorrow = {
      requiredCapabilities: [
        'lottie-light-svg-v1',
        'composer-anchor-v1',
        'interaction-cat-borrow-v1',
        'static-poster-v1',
      ],
      placement: composerAnchor({ scale: { min: 1, max: 1 } }),
      direction: 'none',
      variants: [
        scene.variants[0],
        {
          ...scene.variants[1],
          placement: composerAnchor({ scale: { min: 0.8, max: 0.8 } }),
        },
      ],
    };
    const result = normalizeCelebrationManifest(
      withScene(manifest, catBorrow),
      newYearRef(),
    );
    if ('error' in result) throw new Error(result.error);

    const { pack } = result.value;
    expect(pack.scenes[0]).toMatchObject({
      requiredCapabilities: catBorrow.requiredCapabilities,
      placement: catBorrow.placement,
      direction: 'none',
    });
    expect(pack.scenes[0].variants[1].placement).toEqual(
      catBorrow.variants[1].placement,
    );
    /* Markers and slots live inside the animation, which passes by hash only. */
    expect(pack.assets).toEqual(
      manifest.assets.map(({ assetId, mediaType, bytes, sha256 }) => ({
        assetId,
        mediaType,
        bytes,
        sha256,
      })),
    );
  });

  it('adds Santa to the ordinary pack while keeping its history capability scene-level and its assets opaque', () => {
    const manifest = newYear();
    const original = normalizeCelebrationManifest(manifest, newYearRef());
    if ('error' in original) throw new Error(original.error);
    const santa = {
      ...manifest.scenes[0],
      id: 'santa-history-delivery',
      labelId: 'santaHistoryDeliveryToastMessage',
      requiredCapabilities: [
        'lottie-light-svg-v1',
        'viewport-stage-v1',
        'interaction-history-ladder-v1',
        'static-poster-v1',
      ],
      placement: {
        template: 'viewport-stage-v1',
        fit: 'contain',
        align: 'center',
      },
      direction: 'none',
      timing: {
        playbackDurationMs: 27000,
        loadTimeoutMs: 2000,
        readyTimeoutMs: 250,
        maxLifetimeMs: 29500,
      },
      posterDurationMs: 4000,
    };
    const labels = {
      en: {
        santaHistoryDeliveryToastMessage:
          'Special delivery, with a little help from friends.',
      },
    };
    const result = normalizeCelebrationManifest(
      { ...manifest, scenes: [...manifest.scenes, santa], labels },
      newYearRef(),
    );
    if ('error' in result) throw new Error(result.error);

    const { pack } = result.value;
    expect(pack.eventId).toBe('new-year');
    expect(pack.event).toBeUndefined();
    expect(pack.requiredCapabilities).toEqual(
      original.value.pack.requiredCapabilities,
    );
    expect(pack.requiredCapabilities).not.toContain(
      'interaction-history-ladder-v1',
    );
    expect(pack.scenes.slice(0, -1)).toEqual(original.value.pack.scenes);
    expect(pack.scenes.at(-1)).toEqual(santa);
    expect(pack.labels).toEqual(labels);
    expect(pack.assets).toEqual(original.value.pack.assets);
    expect(result.value.files).toEqual(original.value.files);
  });

  it.each<[string, Record<string, unknown>]>([
    [
      'a different template',
      { template: 'viewport-stage-v1', fit: 'contain', align: 'bottom' },
    ],
    ['an invalid anchor field', composerAnchor({ edge: 'left' })],
  ])('rejects a variant placement with %s', (_name, placement) => {
    const scene = newYear().scenes[0] as {
      variants: Record<string, unknown>[];
    };
    const result = normalizeCelebrationManifest(
      withScene(newYear(), {
        placement: composerAnchor(),
        variants: [{ ...scene.variants[0], placement }],
      }),
      newYearRef(),
    );
    expect(result).toHaveProperty('error');
  });

  it('passes an unknown placement template as its ID alone', () => {
    const result = normalizeCelebrationManifest(
      withScene(newYear(), {
        placement: { template: 'shelf-anchor-v2', shelf: 'left' },
      }),
      newYearRef(),
    );
    if ('error' in result) throw new Error(result.error);
    expect(result.value.pack.scenes[0].placement).toEqual({
      template: 'shelf-anchor-v2',
    });
  });

  const poster = () => newYear().assets[2];

  it.each<[string, () => unknown]>([
    ['schemaVersion 2', () => ({ ...newYear(), schemaVersion: 2 })],
    [
      'an identity that differs from the index',
      () => ({ ...newYear(), version: '1.0.1' }),
    ],
    [
      'an undeclared poster',
      () => withScene(newYear(), { posterAssetId: 'missing-0123456789abcdef' }),
    ],
    [
      'a variant pointing at the SVG poster',
      () =>
        withScene(newYear(), {
          variants: [{ when: {}, animationAssetId: poster().assetId }],
        }),
    ],
    ['no variants', () => withScene(newYear(), { variants: [] })],
    [
      'an unknown variant condition',
      () =>
        withScene(newYear(), {
          variants: [
            {
              when: { reducedMotion: true },
              animationAssetId: newYear().assets[0].assetId,
            },
          ],
        }),
    ],
    [
      'a load timeout over 2000 ms',
      () =>
        withScene(newYear(), {
          timing: {
            playbackDurationMs: 12000,
            loadTimeoutMs: 2001,
            readyTimeoutMs: 250,
            maxLifetimeMs: 15000,
          },
        }),
    ],
    [
      'a lifetime shorter than load + ready + playback',
      () =>
        withScene(newYear(), {
          timing: {
            playbackDurationMs: 12000,
            loadTimeoutMs: 2000,
            readyTimeoutMs: 250,
            maxLifetimeMs: 14000,
          },
        }),
    ],
    [
      'a fractional timing',
      () =>
        withScene(newYear(), {
          timing: {
            playbackDurationMs: 1.5,
            loadTimeoutMs: 2000,
            readyTimeoutMs: 250,
            maxLifetimeMs: 15000,
          },
        }),
    ],
    [
      'a poster shorter than 1000 ms',
      () => withScene(newYear(), { posterDurationMs: 999 }),
    ],
    [
      'an invalid align',
      () =>
        withScene(newYear(), {
          placement: {
            template: 'viewport-stage-v1',
            fit: 'contain',
            align: 'left',
          },
        }),
    ],
    ['an invalid scene ID', () => withScene(newYear(), { id: 'Snowman' })],
    [
      'a media type outside the allowlist',
      () => ({
        ...newYear(),
        assets: [
          ...newYear().assets.slice(0, 2),
          { ...poster(), mediaType: 'text/html' },
        ],
      }),
    ],
    [
      'an asset ID that does not end with its hash prefix',
      () => ({
        ...newYear(),
        assets: [
          ...newYear().assets.slice(0, 2),
          { ...poster(), sha256: 'f'.repeat(64) },
        ],
      }),
    ],
    [
      'an oversized poster',
      () => ({
        ...newYear(),
        assets: [
          ...newYear().assets.slice(0, 2),
          { ...poster(), bytes: 100 * 1024 + 1 },
        ],
      }),
    ],
    [
      'a repeated asset ID',
      () => ({ ...newYear(), assets: [...newYear().assets, poster()] }),
    ],
    [
      'more than 32 assets',
      () => ({
        ...newYear(),
        assets: Array.from({ length: 33 }, () => poster()),
      }),
    ],
    [
      'repeated scene IDs',
      () => ({
        ...newYear(),
        scenes: [newYear().scenes[0], newYear().scenes[0]],
      }),
    ],
    [
      'labels without en',
      () => ({ ...newYear(), labels: { de: { title: 'Hallo' } } }),
    ],
    [
      'a label over 280 characters',
      () => ({ ...newYear(), labels: { en: { title: 'x'.repeat(281) } } }),
    ],
    [
      'a placeholder other than phrase',
      () => ({ ...newYear(), labels: { en: { title: 'Hi {{name}}' } } }),
    ],
    [
      'more than 16 locales',
      () => ({
        ...newYear(),
        labels: Object.fromEntries(
          [
            'en',
            ...Array.from(
              { length: 16 },
              (_, i) => `x${String.fromCharCode(97 + i)}`,
            ),
          ].map((locale) => [locale, {}]),
        ),
      }),
    ],
    [
      'an event label that only exists on Object.prototype',
      () => {
        const manifest = anniversary();
        return {
          ...manifest,
          event: {
            ...(manifest.event as object),
            titleLabelId: 'constructor',
          },
        };
      },
    ],
    [
      'a click scene that is not declared',
      () => {
        const manifest = anniversary();
        return {
          ...manifest,
          event: { ...(manifest.event as object), clickSceneIds: ['sleigh'] },
        };
      },
    ],
    [
      'a decoration template other than static-trigger-v1',
      () => {
        const manifest = anniversary();
        const event = manifest.event as Record<string, unknown>;
        return {
          ...manifest,
          event: {
            ...event,
            decoration: {
              ...(event.decoration as object),
              template: 'animated-trigger',
            },
          },
        };
      },
    ],
  ])('rejects %s', (_, build) => {
    const manifest = build() as Manifest;
    const ref =
      manifest.packId === 'company-anniversary'
        ? anniversaryRef()
        : newYearRef();
    expect(normalizeCelebrationManifest(manifest, ref)).toHaveProperty('error');
  });
});

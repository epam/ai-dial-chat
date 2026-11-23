import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationComposerAnchorPlacement } from '../../models/celebration-pack';
import type { LottieLayer } from '../../models/lottie-composition';
import type { TextRun } from '../../models/text-run-copy';
import snowman from '../../stories/fixtures/copy-track-snowman.desktop.lottie.json';
import snowmanMobile from '../../stories/fixtures/copy-track-snowman.mobile.lottie.json';
import probe from '../../stories/fixtures/copy-track-word-probe.lottie.json';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationPlacementTemplate,
} from '../../types/celebration-pack';
import { CopyTrackSectionKind } from '../../types/copy-track';
import { PackSceneCompanionKind } from '../../types/pack-scene';
import type { PackScenePreparation } from '../celebration-pack-scene';
import { prepareCopyTrackScene } from '../copy-track-adapter';
import { readCopyTrackMarkers } from '../copy-track-markers';

const textRun = vi.hoisted(() => ({ current: null as TextRun | null }));
vi.mock('../text-run-copy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../text-run-copy')>()),
  findTextRun: () => textRun.current,
}));

/* Bootstrapped once from the compiled SnowmanDelivery at reference geometry (design D11). */
const copyOf = (preparation: PackScenePreparation) =>
  preparation.companion?.kind === PackSceneCompanionKind.CopyTrack
    ? preparation.companion.copy
    : undefined;

const FIXTURES = {
  'copy-track-snowman.desktop.lottie.json':
    'e102fb11b63505f431b2f77fb66438cc6f9374242ea23e5c16f16f19187988af',
  'copy-track-snowman.mobile.lottie.json':
    '655cd2599ddb1964fc6c97033ff3d4f6fcb9ed7ffbd676b598c2de5238568f10',
  'copy-track-snowman.poster.svg':
    '9a5fcf2229c5f6db023c9c9f276f9acad5d961dbd8f46b79cd6ac1a4846dc1df',
  'copy-track-word-probe.lottie.json':
    'a2b67517dd802aba7e59adb934b47cf7f5de9f43e49340e37af773e73f5b0520',
};

const anchors: CelebrationAnchors = {
  composer: 'composer',
  starterList: 'starters',
  welcomeRegion: '[role="region"]',
};

const placement: CelebrationComposerAnchorPlacement = {
  template: CelebrationPlacementTemplate.ComposerAnchorV1,
  anchor: CelebrationAnchor.Composer,
  anchorRect: { x: 0, y: 0, width: 240, height: 56 },
  edge: CelebrationAnchorEdge.Top,
  scale: { min: 0.9, max: 0.9 },
  fallback: CelebrationAnchorFallback.StageAnchor,
};

const place = (element: HTMLElement, rect: DOMRect) =>
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);

const build = (withStarters: boolean) => {
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
    1280,
  );
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    900,
  );
  const region = document.createElement('div');
  region.setAttribute('role', 'region');
  document.body.append(region);
  const heading = document.createElement('h1');
  heading.textContent = 'How can I help?';
  region.append(heading);
  place(heading, new DOMRect(440, 200, 400, 40));
  const composer = document.createElement('div');
  composer.className = 'composer';
  region.append(composer);
  place(composer, new DOMRect(360, 400, 560, 100));
  if (withStarters) {
    const list = document.createElement('ul');
    list.className = 'starters';
    region.append(list);
    place(list, new DOMRect(389, 520, 322, 40));
    /* The production starter widths on the ConversationInput host. */
    [
      [389, 164],
      [560, 151],
    ].forEach(([left, width], index) => {
      const button = document.createElement('button');
      button.textContent = `Starter ${index + 1}`;
      list.append(button);
      place(button, new DOMRect(left, 520, width, 40));
    });
  }
  return composer;
};

const countKeyframes = (node: unknown): number => {
  if (Array.isArray(node))
    return node.reduce((sum: number, item) => sum + countKeyframes(item), 0);
  if (typeof node !== 'object' || node === null) return 0;
  const record = node as Record<string, unknown>;
  if (record.a === 1 && Array.isArray(record.k)) return record.k.length;
  return Object.values(record).reduce(
    (sum: number, value) => sum + countKeyframes(value),
    0,
  );
};

describe('copy-track fixtures', () => {
  it.each(Object.entries(FIXTURES))('keeps %s byte-identical', (file, hash) => {
    const bytes = readFileSync(
      join(import.meta.dirname, '../../stories/fixtures', file),
    );

    expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
  });

  it('parses both fixtures under the copy-track grammar', () => {
    expect(
      readCopyTrackMarkers(snowman, { from: 0, to: 3100 }).sections.map(
        ({ kind }) => kind,
      ),
    ).toEqual([
      CopyTrackSectionKind.LedgeCard,
      CopyTrackSectionKind.RimCard,
      CopyTrackSectionKind.Rim,
      CopyTrackSectionKind.Platform,
    ]);
    expect(
      readCopyTrackMarkers(probe, { from: 0, to: 601 }).sections.map(
        ({ kind }) => kind,
      ),
    ).toEqual([CopyTrackSectionKind.RimWord]);
  });

  it.each([
    ['desktop', snowman],
    ['mobile', snowmanMobile],
  ])(
    'keeps the %s variant within the byte, keyframe and layer caps',
    (_, asset) => {
      const layers =
        asset.layers.length +
        (asset.assets as { layers: LottieLayer[] }[])[0].layers.length;

      expect(JSON.stringify(asset).length).toBeLessThanOrEqual(512 * 1024);
      expect(countKeyframes(asset)).toBeLessThanOrEqual(4000);
      expect(layers).toBeLessThanOrEqual(48);
    },
  );
});

/* Every keyframe but the last needs a hold or an easing, or lottie-web throws while interpolating from it. */
const keysWithoutEasing = (node: unknown, out: number[] = []): number[] => {
  if (Array.isArray(node)) node.forEach((item) => keysWithoutEasing(item, out));
  else if (typeof node === 'object' && node !== null) {
    const record = node as Record<string, unknown>;
    if (record.a === 1 && Array.isArray(record.k))
      (record.k as Record<string, unknown>[]).slice(0, -1).forEach((key) => {
        if (key.h !== 1 && !(key.o && key.i)) out.push(key.t as number);
      });
    Object.values(record).forEach((value) => keysWithoutEasing(value, out));
  }
  return out;
};

describe('copy-track fixtures for lottie-web', () => {
  it.each([
    ['desktop', snowman],
    ['mobile', snowmanMobile],
  ])('gives every %s keyframe but the last a hold or an easing', (_, asset) => {
    expect(keysWithoutEasing(asset)).toEqual([]);
  });
});

describe('copy-track fixtures through the adapter', () => {
  beforeEach(() => {
    textRun.current = null;
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: () => ({ cancel: vi.fn(), startTime: null }),
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('prepares the snowman ledge card section on a default start page', () => {
    build(true);

    const preparation = prepareCopyTrackScene(snowman, placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });

    expect(copyOf(preparation)).toBeDefined();
  });

  it('borrows the one starter the compiled scene would on the production row of 183, 303 and 288 px', () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1920,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      1083,
    );
    const region = document.createElement('div');
    region.setAttribute('role', 'region');
    document.body.append(region);
    place(region, new DOMRect(336, 0, 1584, 1047));
    const composer = document.createElement('div');
    composer.className = 'composer';
    region.append(composer);
    place(composer, new DOMRect(778, 455, 700, 114));
    const list = document.createElement('ul');
    list.className = 'starters';
    region.append(list);
    place(list, new DOMRect(368, 641, 1520, 40));
    const buttons = (
      [
        [733, 183],
        [924, 303],
        [1235, 288],
      ] as const
    ).map(([left, width], index) => {
      const button = document.createElement('button');
      button.textContent = `Starter ${index + 1}`;
      list.append(button);
      place(button, new DOMRect(left, 641, width, 40));
      return button;
    });

    const preparation = prepareCopyTrackScene(snowman, placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });

    expect(copyOf(preparation)).toBeDefined();
    expect(
      (
        preparation.companion as { watched: { element: Element }[] }
      ).watched.some(({ element }) => element === buttons[0]),
    ).toBe(true);
  });

  it('prepares the snowman drawn-sled section without starters', () => {
    build(false);

    const preparation = prepareCopyTrackScene(snowman, placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });

    expect(copyOf(preparation)).toBeUndefined();
  });

  it('prepares the word probe on the composer rim', () => {
    const composer = build(false);
    const textarea = document.createElement('textarea');
    composer.append(textarea);
    textRun.current = {
      element: textarea,
      rect: new DOMRect(420, 440, 48, 18),
      text: 'Type',
      style: {},
      background: 'rgb(255, 255, 255)',
    };

    const preparation = prepareCopyTrackScene(probe, placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });

    expect(copyOf(preparation)).toBeDefined();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationComposerAnchorPlacement } from '../../models/celebration-pack';
import type { LottieLayer } from '../../models/lottie-composition';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationPlacementTemplate,
} from '../../types/celebration-pack';
import { PackSceneCompanionKind } from '../../types/pack-scene';
import {
  onCatBorrowAnimationCreated,
  onCatBorrowPlaybackStarted,
  prepareCatBorrowScene,
} from '../cat-borrow-adapter';
import type { PackScenePreparation } from '../celebration-pack-scene';

const catBorrowOf = (companion: PackScenePreparation['companion']) =>
  companion?.kind === PackSceneCompanionKind.CatBorrow ? companion : undefined;

const FPS = 60;
const PLACEMENT: CelebrationComposerAnchorPlacement = {
  template: CelebrationPlacementTemplate.ComposerAnchorV1,
  anchor: CelebrationAnchor.Composer,
  anchorRect: { x: 600, y: 98, width: 240, height: 56 },
  edge: CelebrationAnchorEdge.Top,
  scale: { min: 1, max: 1 },
  fallback: CelebrationAnchorFallback.StageAnchor,
};
const ANCHORS = { composer: 'composer' };

const LINEAR = { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } };
const nul = (nm: string, ks: Record<string, unknown>): LottieLayer =>
  ({ ty: 3, nm, ip: 0, op: 620, ks }) as LottieLayer;
const point = (x: number, y: number) => ({ a: 0, k: [x, y, 0] });
const track = (frames: number[], value: (frame: number) => number[]) => ({
  a: 1,
  k: frames.map((t, index) =>
    index === frames.length - 1
      ? { t, s: value(t) }
      : { t, s: value(t), ...LINEAR },
  ),
});

/*
 * Three sections in rig-local frames: two-prizes 0–300 (branch at 80),
 * one-prize tail 300–520, crossing 520–610. The rig is offset by 1000/1000.
 */
const buildAsset = ({ withMove = false } = {}) => {
  const prizeTrack = (name: string, frames: number[]) =>
    nul(name, {
      p: track(frames, (t) => [t > frames[1] ? 22 : 0, 0, 0]),
      r: track(frames, () => [0]),
      o: track(frames, (t) => [t >= frames[1] ? 100 : 0]),
    });
  const rigLayers: LottieLayer[] = [
    nul('anchor:perch', { p: point(1500, 1100) }),
    nul('anchor:prize-0', { p: point(1600, 1180) }),
    nul('anchor:prize-1', { p: point(1650, 1180) }),
    nul('anchor:entry-edge', { p: point(1000, 1100) }),
    nul('anchor:exit-edge', { p: point(2400, 1180) }),
    nul('anchor:move', { p: point(1622, 1180) }),
    prizeTrack('prize-0', [0, 40, 80, 300, 340, 380]),
    prizeTrack('prize-1', [0, 160, 200]),
    {
      ...nul('cat-root', {
        p: {
          a: 1,
          k: [0, 50, 120, 250, 300, 400, 520, 609].map((t) => ({
            t,
            s: [1500 + t, 1100, 0],
            ...LINEAR,
          })),
        },
      }),
      ind: 1,
    },
    {
      ...nul('cat-facing', {
        s: {
          a: 1,
          k: [
            { t: 0, s: [100, 100, 100], h: 1 },
            ...(withMove
              ? [
                  { t: 100, s: [100, 100, 100], h: 1 },
                  { t: 120, s: [100, 100, 100], h: 1 },
                ]
              : []),
            { t: 609, s: [100, 100, 100] },
          ],
        },
      }),
      parent: 1,
    },
  ];
  const marker = (cm: string, tm: number, dr?: number) =>
    dr === undefined ? { cm, tm } : { cm, tm, dr };
  return {
    v: '5.12.0',
    fr: FPS,
    ip: 0,
    op: 300,
    w: 1440,
    h: 900,
    assets: [{ id: 'cat-rig', layers: rigLayers }],
    layers: [
      {
        ty: 0,
        nm: 'cat-rig',
        refId: 'cat-rig',
        w: 4096,
        h: 4096,
        ip: 0,
        op: 300,
        st: 0,
        ks: { a: point(1000, 1000), p: point(0, 0) },
      },
    ],
    markers: [
      marker('cat:section:two-prizes', 0, 300),
      marker('cat:bind:perch', 0, 50),
      ...(withMove
        ? [marker('cat:bind:prize-0', 50, 50), marker('cat:bind:move', 100, 20)]
        : [marker('cat:bind:prize-0', 50, 70)]),
      marker('cat:bind:prize-1', 120, 180),
      marker('cat:entry:0', 40),
      marker('cat:release:0', 80),
      marker('cat:landing:0', 90),
      marker('cat:branch:one-prize', 80),
      marker('cat:entry:1', 160),
      marker('cat:release:1', 200),
      marker('cat:landing:1', 210, 40),
      marker('cat:restore', 280),
      marker('cat:section:one-prize', 300, 220),
      marker('cat:bind:prize-0', 300, 220),
      marker('cat:entry:0', 340),
      marker('cat:release:0', 380),
      marker('cat:landing:0', 410, 80),
      marker('cat:restore', 500),
      marker('cat:section:crossing', 520, 90),
      marker('cat:bind:entry-edge', 520, 45),
      marker('cat:bind:exit-edge', 565, 45),
    ],
  };
};

type Asset = ReturnType<typeof buildAsset>;

const withoutMarker = (asset: Asset, cm: string): Asset => ({
  ...asset,
  markers: asset.markers.filter((marker) => marker.cm !== cm),
});

const facingOf = (data: unknown) =>
  (
    (data as { assets: { layers: LottieLayer[] }[] }).assets[0].layers.find(
      ({ nm }) => nm === 'cat-facing',
    )?.ks?.s?.k as { t: number; s: number[] }[]
  ).map(({ t, s }) => ({ t, sign: Math.sign(s[0]) }));

const rects = new Map<Element, DOMRect>();

const buildPage = (buttons: [number, number][], viewportHeight = 800) => {
  const region = document.createElement('main');
  region.setAttribute('role', 'region');
  const composer = document.createElement('div');
  composer.className = 'composer';
  region.append(composer);
  rects.set(composer, new DOMRect(290, 353, 700, 114));
  buttons.forEach(([left, width], index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `Button ${index}`;
    composer.append(button);
    rects.set(button, new DOMRect(left, 410, width, 40));
  });
  document.body.append(region);
  vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
    viewportHeight,
  );
};

const remapOf = (data: unknown) =>
  (
    (data as { layers: LottieLayer[] }).layers.find(
      ({ nm }) => nm === 'cat-rig',
    )?.tm as { k: { t: number; s: number[]; h?: number }[] }
  ).k;

describe('prepareCatBorrowScene — story sections', () => {
  beforeEach(() => {
    rects.clear();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        return rects.get(this) ?? new DOMRect(0, 0, 0, 0);
      },
    );
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    const original = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = original(element);
      return {
        ...style,
        visibility: style.visibility || 'visible',
        opacity: style.opacity || '1',
      } as CSSStyleDeclaration;
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('plays the two-prize section when two buttons are reachable', () => {
    /* A 38 px drop falls in about the authored 10 frames, and the composer stays 23 px above the bottom. */
    buildPage(
      [
        [875, 56],
        [933, 40],
      ],
      490,
    );
    const { data, companion } = prepareCatBorrowScene(
      buildAsset(),
      PLACEMENT,
      ANCHORS,
    );
    const borrow = catBorrowOf(companion);
    const remap = remapOf(data);

    expect(remap[0]).toMatchObject({ t: 0, s: [0] });
    expect(remap.some(({ h }) => h === 1)).toBe(false);
    expect(borrow?.watched).toHaveLength(2);
  });

  it('steps to the one-prize tail at the branch when the second fall cannot be absorbed', () => {
    buildPage([
      [875, 56],
      [933, 40],
    ]);
    const { data, companion } = prepareCatBorrowScene(
      buildAsset(),
      PLACEMENT,
      ANCHORS,
    );
    const borrow = catBorrowOf(companion);
    const remap = remapOf(data);
    const step = remap.findIndex(({ h }) => h === 1);

    expect(borrow?.watched).toHaveLength(1);
    expect(step).toBeGreaterThan(0);
    expect(remap[step + 1]).toMatchObject({ t: 80, s: [300 / FPS] });
  });

  it('faces the walk between buttons on opposite sides toward the second stand', () => {
    /* The first prize sits left of the composer center and is pushed toward −x; the second, right of it, toward +x. */
    buildPage(
      [
        [670, 40],
        [600, 40],
      ],
      490,
    );
    const { data, companion } = prepareCatBorrowScene(
      buildAsset({ withMove: true }),
      PLACEMENT,
      ANCHORS,
    );
    const borrow = catBorrowOf(companion);

    expect(borrow?.watched).toHaveLength(2);
    expect(facingOf(data).slice(0, 3)).toEqual([
      { t: 0, sign: -1 },
      /* The second stand (640) lies left of where the first push ends (668), whatever its own side. */
      { t: 100, sign: -1 },
      { t: 120, sign: 1 },
    ]);
  });

  it('reads the stand of a standalone one-prize section from that section', () => {
    /* Without the branch, the one-prize story is the whole tail, which stands 200 units past its anchor. */
    buildPage([[1050, 40]]);
    const { data, companion } = prepareCatBorrowScene(
      withoutMarker(buildAsset(), 'cat:branch:one-prize'),
      PLACEMENT,
      ANCHORS,
    );
    const borrow = catBorrowOf(companion);

    expect(borrow?.watched).toHaveLength(1);
    /* That stand does not fit right of the button, so the cat works it from its end side. */
    expect(facingOf(data)[0]).toEqual({ t: 0, sign: -1 });
  });

  it('fails before measuring when the branch is not at the first release', () => {
    buildPage([[933, 40]]);
    const asset = buildAsset();
    const broken = {
      ...asset,
      markers: asset.markers.map((marker) =>
        marker.cm === 'cat:branch:one-prize' ? { ...marker, tm: 70 } : marker,
      ),
    };

    expect(() => prepareCatBorrowScene(broken, PLACEMENT, ANCHORS)).toThrow(
      'not at "cat:release:0"',
    );
  });

  it('fails when the branch lies outside the two-prize section', () => {
    buildPage([[933, 40]]);
    const asset = withoutMarker(buildAsset(), 'cat:branch:one-prize');
    const broken = {
      ...asset,
      markers: [...asset.markers, { cm: 'cat:branch:one-prize', tm: 380 }],
    };

    expect(() => prepareCatBorrowScene(broken, PLACEMENT, ANCHORS)).toThrow(
      'outside "two-prizes"',
    );
  });

  it('fails when a story would end after the composition', () => {
    buildPage([[933, 40]]);

    expect(() =>
      prepareCatBorrowScene({ ...buildAsset(), op: 200 }, PLACEMENT, ANCHORS),
    ).toThrow('ends after the composition');
  });

  it('installs no copy layer, listener or observer for the crossing', () => {
    buildPage([]);
    const preparation = prepareCatBorrowScene(buildAsset(), PLACEMENT, ANCHORS);
    const host = document.createElement('div');
    const addDisposer = vi.fn();
    const listen = vi.spyOn(document, 'addEventListener');
    const listenOnWindow = vi.spyOn(window, 'addEventListener');
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const context = { preparation, host, addDisposer, cancel: vi.fn() };
    onCatBorrowAnimationCreated(context);
    onCatBorrowPlaybackStarted({ ...context, timelineZeroMs: 0 });

    expect(host.children).toHaveLength(0);
    expect(addDisposer).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
    expect(listenOnWindow).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
  });

  it('plays only the crossing section, trimmed to its length, when no button is reachable', () => {
    buildPage([]);
    const { data, companion } = prepareCatBorrowScene(
      buildAsset(),
      PLACEMENT,
      ANCHORS,
    );
    const borrow = catBorrowOf(companion);
    const remap = remapOf(data);

    expect((data as { op: number }).op).toBe(90);
    expect(remap[0]).toMatchObject({ t: 0, s: [520 / FPS] });
    expect(remap.at(-1)).toMatchObject({ t: 90, s: [610 / FPS] });
    /* The crossing borrows nothing: no copies, listeners or observers. */
    expect(borrow).toBeUndefined();
  });
});

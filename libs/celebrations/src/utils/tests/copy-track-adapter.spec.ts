/* The copies and their layer are inert decorations; there is no accessible role to query them by. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationComposerAnchorPlacement } from '../../models/celebration-pack';
import type { LottieLayer } from '../../models/lottie-composition';
import type { TextRun } from '../../models/text-run-copy';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationPlacementTemplate,
} from '../../types/celebration-pack';
import { PackSceneCompanionKind } from '../../types/pack-scene';
import type { PackScenePreparation } from '../celebration-pack-scene';
import {
  onCopyTrackAnimationCreated,
  onCopyTrackPlaybackStarted,
  prepareCopyTrackScene,
} from '../copy-track-adapter';

const textRun = vi.hoisted(() => ({ current: null as TextRun | null }));
vi.mock('../text-run-copy', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../text-run-copy')>()),
  findTextRun: () => textRun.current,
}));

const copyOf = (preparation: PackScenePreparation) =>
  preparation.companion?.kind === PackSceneCompanionKind.CopyTrack
    ? preparation.companion.copy
    : undefined;

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

const FLIGHT = 1.347;
const nullLayer = (
  nm: string,
  ks: LottieLayer['ks'],
  extra = {},
): LottieLayer => ({
  ty: 3,
  nm,
  ip: 0,
  op: 150,
  ks,
  ...extra,
});
const at = (x: number, y = 0) => ({ a: 0, k: [x, y, 0] });
const rectangle = (nm: string, x: number, y: number, w: number, h: number) => ({
  ty: 4,
  nm,
  ip: 0,
  op: 150,
  ks: {},
  shapes: [{ ty: 'rc', p: { a: 0, k: [x, y] }, s: { a: 0, k: [w, h] } }],
});
const keys = (...frames: [number, number[], boolean?][]) => ({
  a: 1,
  k: frames.map(([t, s, isHold]) => ({ t, s, ...(isHold ? { h: 1 } : {}) })),
});

/* Stance at the stage origin; slides of 160–460 px at 0.9; the far point 0.347 of the slide past its end. */
const MAX = 460 / 0.9;
const MIN = 160 / 0.9;
const far = 60 + MAX * FLIGHT;

const asset = (sections = ['ledge-card', 'rim']) => ({
  v: '5.13.0',
  fr: 60,
  ip: 0,
  op: 120,
  w: 1200,
  h: 900,
  assets: [
    {
      id: 'actor',
      layers: [
        nullLayer(
          'ct-track:root',
          {
            p: keys(
              [0, [-200, 0, 0]],
              [20, [0, 0, 0]],
              [40, [60, 0, 0]],
              [60, [300, 0, 0]],
              [70, [60 + MAX, 0, 0]],
              [119, [60 + MAX, 0, 0]],
            ),
          },
          { ind: 1 },
        ),
        nullLayer(
          'ct-facing',
          {
            s: keys([0, [100, 100, 100], true], [120, [100, 100, 100]]),
          },
          { parent: 1 },
        ),
        nullLayer('ct-track:copy', {
          p: keys(
            [0, [100, -40, 0], true],
            [30, [100, -40, 0]],
            [60, [300, -20, 0]],
            [80, [120, -40, 0]],
            [90, [120, -40, 0]],
            [100, [100, -40, 0]],
            [119, [100, -40, 0]],
          ),
          r: keys(
            [0, [0], true],
            [30, [0]],
            [60, [-10]],
            [80, [0]],
            [90, [0]],
            [100, [0]],
            [119, [0]],
          ),
          o: keys(
            [0, [100], true],
            [30, [100]],
            [60, [100]],
            [80, [100]],
            [90, [100]],
            [100, [100]],
            [119, [100]],
          ),
        }),
        rectangle('ct-if:copy card-ref', 100, -40, 140 / 0.9, 44),
        rectangle('ct-if:no-copy sled', 100, -8, 70, 16),
      ],
    },
  ],
  layers: [
    nullLayer('anchor:stance', { p: at(0) }),
    nullLayer('anchor:entry-edge', { p: at(-200) }),
    nullLayer('anchor:span-start', { p: at(60) }),
    nullLayer('anchor:span-start@min', { p: at(60) }),
    nullLayer('anchor:span-end', { p: at(60 + MAX) }),
    nullLayer('anchor:span-end@min', { p: at(60 + MIN) }),
    nullLayer('anchor:far', { p: at(far, -62) }),
    nullLayer('anchor:far@min', { p: at(60 + MIN * FLIGHT, -62) }),
    rectangle('ct-band', far - 100, -75, 320, 150),
    nullLayer('ct-follow:far', { p: at(far, -62) }),
    nullLayer(
      'ct-travel',
      {
        p: keys(
          [0, [0, 0, 0], true],
          [80, [0, 0, 0]],
          [100, [-MAX, 0, 0], true],
          [120, [-MAX, 0, 0]],
        ),
      },
      { ind: 10 },
    ),
    {
      ty: 0,
      nm: 'ct-actor',
      refId: 'actor',
      ip: 0,
      op: 120,
      st: 0,
      parent: 10,
      ks: {},
    },
  ],
  markers: [
    ...sections.map((kind) => ({ cm: `ct:section:${kind}`, tm: 0, dr: 0 })),
    { cm: 'ct:trunk', tm: 0, dr: 120 },
    ...(sections.includes('rim')
      ? [
          { cm: 'ct:cut:rim', tm: 25, dr: 10 },
          { cm: 'ct:fill:rim', tm: 130, dr: 10 },
        ]
      : []),
    { cm: 'ct:bind:entry-edge', tm: 0, dr: 20 },
    { cm: 'ct:bind:stance', tm: 20, dr: 20 },
    { cm: 'ct:bind:span-start', tm: 40, dr: 10 },
    { cm: 'ct:stretch', tm: 50, dr: 20 },
    { cm: 'ct:bind:span-end', tm: 70, dr: 80 },
    { cm: 'ct:cycle:0', tm: 80, dr: 10 },
    { cm: 'ct:cycle-window:0', tm: 80, dr: 20 },
    { cm: 'ct:entry', tm: 30, dr: 0 },
    { cm: 'ct:restore', tm: 100, dr: 0 },
  ],
});

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const place = (element: HTMLElement, { left, top, width, height }: Box) =>
  vi
    .spyOn(element, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(left, top, width, height));

const build = (withStarters = true) => {
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
  place(heading, { left: 440, top: 200, width: 400, height: 40 });
  const composer = document.createElement('div');
  composer.className = 'composer';
  region.append(composer);
  place(composer, { left: 360, top: 400, width: 560, height: 100 });
  const buttons: HTMLButtonElement[] = [];
  if (withStarters) {
    const list = document.createElement('ul');
    list.className = 'starters';
    region.append(list);
    place(list, { left: 400, top: 520, width: 300, height: 40 });
    [400, 560].forEach((left, index) => {
      const button = document.createElement('button');
      button.textContent = `Starter ${index + 1}`;
      list.append(button);
      place(button, { left, top: 520, width: 140, height: 40 });
      buttons.push(button);
    });
  }
  return { composer, buttons };
};

const actorLayers = (preparation: PackScenePreparation) =>
  (
    preparation.data as {
      assets: { layers: LottieLayer[] }[];
    }
  ).assets[0].layers;
const rootLayers = (preparation: PackScenePreparation) =>
  (preparation.data as { layers: LottieLayer[] }).layers;
const layerNamed = (layers: LottieLayer[], prefix: string) =>
  layers.find(({ nm }) => nm?.startsWith(prefix)) as LottieLayer;

const recorded: {
  element: Element;
  animation: { cancel: ReturnType<typeof vi.fn>; startTime: number | null };
}[] = [];

const runContext = (preparation: PackScenePreparation) => {
  const host = document.createElement('div');
  document.body.append(host);
  const disposers: (() => void)[] = [];
  const cancel = vi.fn();
  onCopyTrackAnimationCreated({
    preparation,
    host,
    addDisposer: (dispose: () => void) => disposers.push(dispose),
    cancel,
  } as never);
  return {
    host,
    cancel,
    dispose: () =>
      disposers
        .splice(0)
        .reverse()
        .forEach((dispose) => dispose()),
  };
};

describe('prepareCopyTrackScene', () => {
  beforeEach(() => {
    recorded.length = 0;
    textRun.current = null;
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value(this: Element) {
        const animation = { cancel: vi.fn(), startTime: null };
        recorded.push({ element: this, animation });
        return animation;
      },
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('plays the ledge card section, shows the reference card and hides the drawn stand-in', () => {
    build();

    const preparation = prepareCopyTrackScene(asset(), placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });

    expect(copyOf(preparation)).toBeDefined();
    expect(layerNamed(actorLayers(preparation), 'ct-if:no-copy').ks?.o).toEqual(
      { a: 0, k: 0 },
    );
    expect(
      layerNamed(actorLayers(preparation), 'ct-if:copy').ks?.o,
    ).toBeUndefined();
    expect(layerNamed(rootLayers(preparation), 'ct-actor').tm).toBeDefined();
  });

  it('splices the drawn-sled window into the actor remap when no card is available', () => {
    build(false);

    const preparation = prepareCopyTrackScene(asset(), placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });
    const remap = layerNamed(rootLayers(preparation), 'ct-actor').tm as {
      k: { t: number; s: number[]; h?: number }[];
    };

    expect(copyOf(preparation)).toBeUndefined();
    expect(layerNamed(actorLayers(preparation), 'ct-if:copy').ks?.o).toEqual({
      a: 0,
      k: 0,
    });
    /* The fill plays at the cut's composition time: 25 frames = 130 / 60 s in the actor. */
    expect(
      remap.k.some(({ t, s }) => t === 25 && Math.abs(s[0] - 130 / 60) < 1e-9),
    ).toBe(true);
  });

  it('maps the entry through a splice when the section replaces the range it lies in', () => {
    build();
    const spliced = asset(['ledge-card', 'rim']);
    spliced.markers = spliced.markers.map((marker) =>
      marker.cm === 'ct:section:ledge-card'
        ? { ...marker, cm: 'ct:section:rim-card' }
        : marker,
    );
    spliced.markers.push(
      { cm: 'ct:cut:rim-card', tm: 25, dr: 10 },
      { cm: 'ct:fill:rim-card', tm: 130, dr: 10 },
    );
    spliced.markers = spliced.markers.map((marker) =>
      marker.cm === 'ct:entry' ? { ...marker, tm: 28 } : marker,
    );
    const copy = spliced.assets[0].layers.find(
      ({ nm }) => nm === 'ct-track:copy',
    ) as LottieLayer;
    /* The copy path steps at both edges of the cut and of its fill, so each needs a key. */
    for (const key of ['p', 'r', 'o'] as const) {
      const property = copy.ks?.[key] as {
        k: { t: number; s: number[]; h?: number }[];
      };
      const [first] = property.k;
      property.k.push(
        ...[25, 35].map((t) => ({ ...first, t, h: 1 })),
        ...[130, 133, 140].map((t) => ({ ...property.k[3], t, h: 1 })),
      );
      property.k.sort((a, b) => a.t - b.t);
    }

    expect(() =>
      prepareCopyTrackScene(spliced, placement, {
        anchors,
        isMobile: false,
        direction: 'ltr',
      }),
    ).not.toThrow();
  });

  it('mirrors the whole stage when the story travels toward −x', () => {
    build();

    const preparation = prepareCopyTrackScene(asset(), placement, {
      anchors,
      isMobile: false,
      direction: 'rtl',
    });
    const anchorNull = layerNamed(rootLayers(preparation), 'composer-anchor');

    expect(preparation.anchor?.isMirrored).toBe(true);
    expect((anchorNull.ks?.s?.k as number[])[0]).toBeLessThan(0);
  });

  it('fails before measuring when a slot is missing', () => {
    const malformed = asset();
    malformed.layers = malformed.layers.filter(({ nm }) => nm !== 'ct-travel');
    const measure = vi.spyOn(document.documentElement, 'clientWidth', 'get');

    expect(() =>
      prepareCopyTrackScene(malformed, placement, {
        anchors,
        isMobile: false,
        direction: 'ltr',
      }),
    ).toThrow('"ct-travel"');
    expect(measure).not.toHaveBeenCalled();
  });

  it('fails on a section kind the adapter does not define', () => {
    build();

    expect(() =>
      prepareCopyTrackScene(asset(['ledge-card', 'sky']), placement, {
        anchors,
        isMobile: false,
        direction: 'ltr',
      }),
    ).toThrow('unknown argument');
  });

  it('lays a section out from its own references and travel when the asset overrides them', () => {
    const position = (layers: LottieLayer[], name: string, frame: number) => {
      const property = layerNamed(layers, name).ks?.p as {
        a: number;
        k: { t: number; s: number[] }[] | number[];
      };
      if (property.a !== 1) return (property.k as number[])[0];
      const keyframes = property.k as { t: number; s: number[] }[];
      return [...keyframes].reverse().find(({ t }) => t <= frame)?.s[0] ?? 0;
    };
    build(false);
    const base = prepareCopyTrackScene(asset(), placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });
    const overridden = asset();
    overridden.layers.push(
      nullLayer('anchor:far#rim', { p: at(far - 30, -62) }),
      nullLayer('anchor:far@min#rim', { p: at(60 + MIN * FLIGHT - 30, -62) }),
      nullLayer('ct-travel#rim', {
        p: keys(
          [0, [0, 0, 0], true],
          [80, [0, 0, 0]],
          [100, [-MAX / 2, 0, 0], true],
          [120, [-MAX / 2, 0, 0]],
        ),
      }),
    );
    document.body.replaceChildren();
    vi.restoreAllMocks();
    build(false);

    const preparation = prepareCopyTrackScene(overridden, placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });
    const layers = rootLayers(preparation);

    expect(layers.some(({ nm }) => nm?.includes('#'))).toBe(false);
    /* The follow group keeps its offset from the base reference, so it moves with the nearer far anchor. */
    expect(
      position(layers, 'ct-follow:far', 0) -
        position(rootLayers(base), 'ct-follow:far', 0),
    ).toBeCloseTo(-30, 6);
    expect(
      position(layers, 'ct-travel', 100) -
        position(rootLayers(base), 'ct-travel', 100),
    ).toBeCloseTo(MAX / 2, 6);
  });

  it.each([
    ['anchor:far#sky', 'names no declared section'],
    ['anchor:stance#rim', 'overrides no reference'],
    ['ct-follow:far#rim,rim', 'overridden twice'],
  ])('fails before measuring on the override %s', (name, message) => {
    const malformed = asset();
    malformed.layers.push(nullLayer(name, { p: at(0) }));
    const measure = vi.spyOn(document.documentElement, 'clientWidth', 'get');

    expect(() =>
      prepareCopyTrackScene(malformed, placement, {
        anchors,
        isMobile: false,
        direction: 'ltr',
      }),
    ).toThrow(message);
    expect(measure).not.toHaveBeenCalled();
  });

  it('fails before measuring on a cycle whose last pose differs from its first', () => {
    const open = asset();
    const root = open.assets[0].layers.find(
      ({ nm }) => nm === 'ct-track:root',
    ) as LottieLayer;
    const rootKeys = (root.ks?.p as { k: { t: number; s: number[] }[] }).k;
    rootKeys.push(
      { t: 80, s: [60 + MAX, 0, 0] },
      { t: 85, s: [60 + MAX - 20, 0, 0] },
      { t: 90, s: [60 + MAX + 5, 0, 0] },
    );
    rootKeys.sort((a, b) => a.t - b.t);
    const measure = vi.spyOn(document.documentElement, 'clientWidth', 'get');

    expect(() =>
      prepareCopyTrackScene(open, placement, {
        anchors,
        isMobile: false,
        direction: 'ltr',
      }),
    ).toThrow('does not close cycle 80');
    expect(measure).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an override without a position',
      (malformed: ReturnType<typeof asset>) =>
        malformed.layers.push(nullLayer('anchor:far#rim', {})),
      'has no static p',
    ],
    [
      'a moved band',
      (malformed: ReturnType<typeof asset>) => {
        const band = malformed.layers.find(({ nm }) => nm === 'ct-band') as {
          ks: Record<string, unknown>;
        };
        band.ks = { p: at(40) };
      },
      '"ct-band" is moved, scaled or rotated',
    ],
  ])('fails before measuring on %s', (_, breakAsset, message) => {
    const malformed = asset();
    breakAsset(malformed);
    const measure = vi.spyOn(document.documentElement, 'clientWidth', 'get');

    expect(() =>
      prepareCopyTrackScene(malformed, placement, {
        anchors,
        isMobile: false,
        direction: 'ltr',
      }),
    ).toThrow(message);
    expect(measure).not.toHaveBeenCalled();
  });

  it('reads the reference card by its slot, so other copy-only art may be any shape', () => {
    build();
    const decorated = asset();
    decorated.assets[0].layers.unshift(
      nullLayer('ct-if:copy ribbon', {}) as never,
    );

    expect(() =>
      prepareCopyTrackScene(decorated, placement, {
        anchors,
        isMobile: false,
        direction: 'ltr',
      }),
    ).not.toThrow();
  });

  it('cancels a section without a copy on any interaction, but not on a scroll inside the scene', () => {
    build(false);
    const preparation = prepareCopyTrackScene(asset(), placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });
    const { host, cancel, dispose } = runContext(preparation);

    host.dispatchEvent(new Event('scroll'));
    expect(cancel).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    expect(cancel).toHaveBeenCalledOnce();
    dispose();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }));
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('scales the repeated cycle to the measured travel per cycle', () => {
    build();
    /* A narrower page shortens the span, and with it the walk back. */
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1040,
    );
    const walking = asset();
    const root = walking.assets[0].layers.find(
      ({ nm }) => nm === 'ct-track:root',
    ) as LottieLayer;
    const rootKeys = (root.ks?.p as { k: { t: number; s: number[] }[] }).k;
    rootKeys.push(
      { t: 80, s: [60 + MAX, 0, 0] },
      { t: 85, s: [60 + MAX - 20, 0, 0] },
      { t: 90, s: [60 + MAX, 0, 0] },
    );
    rootKeys.sort((a, b) => a.t - b.t);
    /* The walk back ends at the stance, so the travel follows the span. */
    walking.markers = walking.markers.flatMap((marker) =>
      marker.cm === 'ct:bind:span-end'
        ? [
            { ...marker, dr: 30 },
            { cm: 'ct:bind:stance', tm: 100, dr: 50 },
          ]
        : [marker],
    );

    const preparation = prepareCopyTrackScene(walking, placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });
    const prepared = (
      layerNamed(actorLayers(preparation), 'ct-track:root').ks?.p as {
        k: { t: number; s: number[] }[];
      }
    ).k;
    const travel = (
      layerNamed(rootLayers(preparation), 'ct-travel').ks?.p as {
        k: { t: number; s: number[] }[];
      }
    ).k;
    const at80 = prepared.find(({ t }) => t === 80)?.s[0] as number;
    const at85 = prepared.find(({ t }) => t === 85)?.s[0] as number;
    const distance = Math.abs(
      (travel.find(({ t }) => t === 100)?.s[0] as number) -
        (travel.find(({ t }) => t === 80)?.s[0] as number),
    );
    const stride = MAX / 2;
    const count = Math.max(1, Math.round(distance / stride));

    expect(distance).not.toBeCloseTo(MAX, 0);
    expect(at85 - at80).toBeCloseTo((-20 * distance) / (count * stride), 6);
  });

  it('fails when no section fits the page', () => {
    build(false);

    expect(() =>
      prepareCopyTrackScene(asset(['ledge-card']), placement, {
        anchors,
        isMobile: false,
        direction: 'ltr',
      }),
    ).toThrow('no section fits');
  });

  it('attaches the copy beneath the renderer and starts it on the Lottie clock', () => {
    const { buttons } = build();
    const preparation = prepareCopyTrackScene(asset(), placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });
    const { host } = runContext(preparation);

    expect(host.firstElementChild?.hasAttribute('data-copy-track-copies')).toBe(
      true,
    );
    expect(recorded).toHaveLength(0);

    onCopyTrackPlaybackStarted({ preparation, timelineZeroMs: 950 } as never);

    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded.some(({ element }) => element === buttons[0])).toBe(true);
    recorded.forEach(({ animation }) => expect(animation.startTime).toBe(950));
  });

  it('cancels the scene when the copy stops before the restore, and restores once on dispose', () => {
    build();
    const preparation = prepareCopyTrackScene(asset(), placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });
    const { host, cancel, dispose } = runContext(preparation);
    onCopyTrackPlaybackStarted({ preparation, timelineZeroMs: 0 } as never);

    document.dispatchEvent(new Event('pointerdown'));
    expect(cancel).toHaveBeenCalled();

    dispose();
    expect(host.children).toHaveLength(0);
    recorded.forEach(({ animation }) =>
      expect(animation.cancel).toHaveBeenCalledOnce(),
    );
  });

  it('copies a composer word, and typing during the copy cancels the scene in the same task', () => {
    const { composer } = build(false);
    const textarea = document.createElement('textarea');
    composer.append(textarea);
    textRun.current = {
      element: textarea,
      rect: new DOMRect(420, 440, 48, 18),
      text: 'Type',
      style: {},
      background: 'rgb(255, 255, 255)',
    };
    const wordAsset = asset(['rim-word']);
    const preparation = prepareCopyTrackScene(wordAsset, placement, {
      anchors,
      isMobile: false,
      direction: 'ltr',
    });
    const { host, cancel } = runContext(preparation);
    onCopyTrackPlaybackStarted({ preparation, timelineZeroMs: 0 } as never);
    const layer = host.firstElementChild as HTMLElement;
    expect(layer.textContent).toContain('Type');

    textarea.dispatchEvent(new Event('beforeinput', { bubbles: true }));

    expect(cancel).toHaveBeenCalled();
    expect(layer.textContent).toBe('');
    expect(textarea.value).toBe('');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationComposerAnchorPlacement } from '../../models/celebration-pack';
import type { LottieLayer } from '../../models/lottie-composition';
import spike from '../../stories/fixtures/cat-borrow-spike.lottie.json';
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

const PLACEMENT: CelebrationComposerAnchorPlacement = {
  template: CelebrationPlacementTemplate.ComposerAnchorV1,
  anchor: CelebrationAnchor.Composer,
  anchorRect: { x: 600, y: 98, width: 240, height: 56 },
  edge: CelebrationAnchorEdge.Top,
  scale: { min: 1, max: 1 },
  fallback: CelebrationAnchorFallback.StageAnchor,
};
const ANCHORS = { composer: 'composer', starterList: 'starters' };
const VIEWPORT = { width: 1280, height: 800 };
const originalAnimate = Object.getOwnPropertyDescriptor(
  Element.prototype,
  'animate',
);
const originalTimeline = Object.getOwnPropertyDescriptor(document, 'timeline');

interface Rig {
  layers: LottieLayer[];
}

type Data = typeof spike & {
  assets: Rig[];
  layers: LottieLayer[];
  markers: { tm: number; cm: string; dr?: number }[];
};

const brokenSpike = (change: (data: Data) => void): Data => {
  const data = structuredClone(spike) as Data;
  change(data);
  return data;
};

const rects = new Map<Element, DOMRect>();
const place = (
  element: Element,
  left: number,
  top: number,
  w: number,
  h: number,
) => rects.set(element, new DOMRect(left, top, w, h));

/* The real composer geometry at 1280 × 800, with only Send borrowable. */
const buildPage = ({ sendLeft = 933, withSupport = false } = {}) => {
  const region = document.createElement('main');
  region.setAttribute('role', 'region');
  const composer = document.createElement('div');
  composer.className = 'composer';
  const textarea = document.createElement('textarea');
  textarea.value = 'My unsent draft';
  const send = document.createElement('button');
  send.type = 'button';
  send.textContent = 'Send';
  composer.append(textarea, send);
  region.append(composer);
  place(composer, 290, 353, 700, 114);
  place(textarea, 306, 370, 668, 24);
  place(send, sendLeft, 410, 40, 40);
  if (withSupport) {
    const list = document.createElement('ul');
    list.className = 'starters';
    const item = document.createElement('li');
    const starter = document.createElement('button');
    starter.type = 'button';
    starter.textContent = 'Tell me a riddle';
    item.append(starter);
    list.append(item);
    region.append(list);
    place(list, 32, 520, 1216, 40);
    place(starter, sendLeft - 20, 520, 160, 40);
  }
  document.body.append(region);
  return { composer, send, textarea };
};

const rigOf = (data: unknown) => (data as Data).assets[0].layers;
const layerOf = (layers: LottieLayer[], name: string) =>
  layers.find(({ nm }) => nm === name) as LottieLayer;
const positions = (layers: LottieLayer[]) =>
  (layerOf(layers, 'cat-root').ks?.p?.k as { t: number; s: number[] }[]).map(
    ({ t, s }) => ({ t, s }),
  );

describe('prepareCatBorrowScene', () => {
  beforeEach(() => {
    rects.clear();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        return rects.get(this) ?? new DOMRect(0, 0, 0, 0);
      },
    );
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      VIEWPORT.width,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      VIEWPORT.height,
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
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: () => ({ cancel: vi.fn(), startTime: null }),
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
    if (originalAnimate)
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  });

  it('keeps the station keyframes at reference geometry and adds no keyframe', () => {
    buildPage();
    const { data } = prepareCatBorrowScene(spike, PLACEMENT, ANCHORS);
    const authored = positions(rigOf(spike));
    const moved = positions(rigOf(data));

    expect(moved.map(({ t }) => t)).toEqual(authored.map(({ t }) => t));
    moved.forEach(({ s }, index) =>
      s.forEach((value, axis) =>
        expect(value).toBeCloseTo(authored[index].s[axis], 3),
      ),
    );
  });

  it('moves the stand points with the measured button', () => {
    buildPage({ sendLeft: 833 });
    const { data } = prepareCatBorrowScene(spike, PLACEMENT, ANCHORS);
    const authored = positions(rigOf(spike));
    const moved = positions(rigOf(data));

    moved.forEach(({ s }, index) =>
      expect(s[0] - authored[index].s[0]).toBeCloseTo(-100, 3),
    );
  });

  it('works from the other side when the button sits in the composer start half', () => {
    buildPage({ sendLeft: 320 });
    const { data } = prepareCatBorrowScene(spike, PLACEMENT, ANCHORS);
    const facing = layerOf(rigOf(data), 'cat-facing').ks?.s?.k as {
      s: number[];
    }[];

    expect(facing.every(({ s }) => s[0] === -100)).toBe(true);
  });

  it('never mutates the loaded animation', () => {
    buildPage();
    const before = structuredClone(spike);
    prepareCatBorrowScene(spike, PLACEMENT, ANCHORS);

    expect(spike).toEqual(before);
  });

  it('writes a time remap that re-times the reaction to the physical fall', () => {
    buildPage({ withSupport: true });
    const { data } = prepareCatBorrowScene(spike, PLACEMENT, ANCHORS);
    const remap = layerOf((data as Data).layers, 'cat-rig').tm as {
      k: { t: number }[];
    };

    /* A 70 px drop falls faster than the authored 348 px one: four pieces. */
    expect(remap.k.length).toBe(5);
    expect(remap.k[0].t).toBe(0);
  });

  it('removes the floor when the copy lands on a starter button', () => {
    buildPage({ withSupport: true });
    const { data } = prepareCatBorrowScene(spike, PLACEMENT, ANCHORS);

    expect((data as Data).layers.some(({ nm }) => nm === 'cat-floor')).toBe(
      false,
    );
  });

  it('fits the floor under a copy that falls to the bottom', () => {
    buildPage();
    const { data } = prepareCatBorrowScene(spike, PLACEMENT, ANCHORS);
    const floor = layerOf((data as Data).layers, 'cat-floor');
    const rectangle = (floor.shapes?.[0]?.it ?? []).find(
      ({ ty }) => ty === 'rc',
    ) as { s: { k: number[] } };

    expect(rectangle.s.k).toEqual([64, 4]);
  });

  it('fails before playback when no button is reachable and the asset has no crossing', () => {
    buildPage({ sendLeft: 1236 });

    expect(() => prepareCatBorrowScene(spike, PLACEMENT, ANCHORS)).toThrow(
      'no section for this page',
    );
  });

  it('fails before playback on a duplicate bind marker', () => {
    buildPage();
    const broken = structuredClone(spike) as Data & { markers: object[] };
    broken.markers.push({ tm: 10, cm: 'cat:bind:perch', dr: 5 });

    expect(() => prepareCatBorrowScene(broken, PLACEMENT, ANCHORS)).toThrow(
      'Malformed marker',
    );
  });

  it('borrows from the composer the stage is anchored to, not from an earlier match', () => {
    /* Too narrow to anchor the stage, but visible and holding a borrowable button. */
    const decoy = document.createElement('div');
    decoy.className = 'composer';
    const decoyButton = document.createElement('button');
    decoyButton.type = 'button';
    decoy.append(decoyButton);
    document.body.append(decoy);
    place(decoy, 40, 600, 200, 60);
    place(decoyButton, 60, 610, 40, 40);
    const { send } = buildPage();
    const { companion } = prepareCatBorrowScene(spike, PLACEMENT, ANCHORS);
    const borrow =
      companion?.kind === PackSceneCompanionKind.CatBorrow
        ? companion
        : undefined;

    expect(borrow?.watched.map(({ element }) => element)).toEqual([send]);
  });

  it.each([
    [
      'a missing entry',
      (data: Data) => {
        data.markers = data.markers.filter(({ cm }) => cm !== 'cat:entry:0');
      },
      'no "cat:entry:0"',
    ],
    [
      'a missing restore',
      (data: Data) => {
        data.markers = data.markers.filter(({ cm }) => cm !== 'cat:restore');
      },
      'no "cat:restore"',
    ],
    [
      'an entry in the first hundredth of the story',
      (data: Data) => {
        const entry = data.markers.find(({ cm }) => cm === 'cat:entry:0');
        if (entry) entry.tm = 2;
      },
      "outside the story's hide window",
    ],
    [
      'a rig with a parent',
      (data: Data) => {
        data.layers[0].parent = 99;
      },
      'has a parent',
    ],
    [
      'a rotating rig',
      (data: Data) => {
        const rig = data.layers[0] as LottieLayer;
        const ks = rig.ks ?? {};
        rig.ks = {
          ...ks,
          r: {
            a: 1,
            k: [
              { t: 0, s: [0] },
              { t: 10, s: [5] },
            ],
          },
        };
      },
      'scaled or rotated',
    ],
    [
      'a duplicated prize track',
      (data: Data) => {
        const track = data.assets[0].layers.find(({ nm }) => nm === 'prize-0');
        if (track) data.assets[0].layers.push(structuredClone(track));
      },
      'expected one "prize-0" layer, found 2',
    ],
    [
      'a story longer than the composition',
      (data: Data) => {
        data.op = 500;
      },
      'ends after the composition',
    ],
  ])('fails before playback on %s', (_name, change, message) => {
    buildPage();

    expect(() =>
      prepareCatBorrowScene(brokenSpike(change), PLACEMENT, ANCHORS),
    ).toThrow(message);
  });

  it('rejects a malformed floor even when no copy falls to it', () => {
    buildPage({ withSupport: true });
    const broken = brokenSpike((data) => {
      const floor = data.layers.find(({ nm }) => nm === 'cat-floor');
      const items = floor?.shapes?.[0]?.it;
      const rectangle = items?.find(({ ty }) => ty === 'rc');
      if (items && rectangle) items.unshift(structuredClone(rectangle));
    });

    expect(() => prepareCatBorrowScene(broken, PLACEMENT, ANCHORS)).toThrow(
      '"cat-floor" is not one rectangle with a gradient',
    );
  });

  it('fails before playback when the rig carries its own time remap', () => {
    buildPage();
    const broken = structuredClone(spike) as Data;
    (broken.layers[0] as LottieLayer).tm = { a: 0, k: 0 };

    expect(() => prepareCatBorrowScene(broken, PLACEMENT, ANCHORS)).toThrow(
      'own time remap',
    );
  });
});

describe('cat-borrow session callbacks', () => {
  let preparation: PackScenePreparation;
  let host: HTMLElement;
  let page: ReturnType<typeof buildPage>;
  const disposers: (() => void)[] = [];
  const cancel = vi.fn();
  const animations: { startTime: number | null; cancel: () => void }[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    disposers.length = 0;
    animations.length = 0;
    rects.clear();
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        return rects.get(this) ?? new DOMRect(0, 0, 0, 0);
      },
    );
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      VIEWPORT.width,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      VIEWPORT.height,
    );
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: () => {
        const animation = { startTime: null, cancel: vi.fn() };
        animations.push(animation);
        return animation;
      },
    });
    Object.defineProperty(document, 'timeline', {
      configurable: true,
      value: { currentTime: 5000 },
    });
    page = buildPage();
    preparation = prepareCatBorrowScene(spike, PLACEMENT, ANCHORS);
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(() => {
    disposers.reverse().forEach((dispose) => dispose());
    document.body.replaceChildren();
    vi.restoreAllMocks();
    if (originalAnimate)
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
    if (originalTimeline)
      Object.defineProperty(document, 'timeline', originalTimeline);
    vi.unstubAllGlobals();
  });

  const created = () =>
    onCatBorrowAnimationCreated({
      preparation,
      host,
      addDisposer: (dispose) => disposers.push(dispose),
      cancel,
    });

  it('attaches the invisible copy beneath the renderer without animating anything', () => {
    created();
    const layer = host.firstElementChild as HTMLElement;

    expect(layer.inert).toBe(true);
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.querySelector('[data-cat-prize="0"]')).toBeTruthy();
    expect(animations).toHaveLength(0);
  });

  it('starts the copy and the original on the reported frame-0 time', () => {
    created();
    onCatBorrowPlaybackStarted({
      preparation,
      host,
      addDisposer: (dispose) => disposers.push(dispose),
      cancel,
      timelineZeroMs: 4200,
    });

    expect(animations).toHaveLength(2);
    animations.forEach(({ startTime }) => expect(startTime).toBe(4200));
  });

  it('cancels the scene when the copies stop before the restore', () => {
    created();
    onCatBorrowPlaybackStarted({
      preparation,
      host,
      addDisposer: (dispose) => disposers.push(dispose),
      cancel,
      timelineZeroMs: 4200,
    });
    document.dispatchEvent(new Event('pointerdown'));

    expect(cancel).toHaveBeenCalledOnce();
    expect(host.querySelector('[data-cat-prize]')).toBeNull();
  });

  it('keeps playing when the copies stop after the restore', () => {
    created();
    onCatBorrowPlaybackStarted({
      preparation,
      host,
      addDisposer: (dispose) => disposers.push(dispose),
      cancel,
      timelineZeroMs: 4200,
    });
    Object.defineProperty(document, 'timeline', {
      configurable: true,
      value: {
        currentTime:
          4200 +
          ((preparation.companion?.kind === PackSceneCompanionKind.CatBorrow
            ? preparation.companion.restoreMs
            : 0) ?? 0) +
          1,
      },
    });
    document.dispatchEvent(new Event('pointerdown'));

    expect(host.querySelector('[data-cat-prize]')).toBeNull();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('removes the copy layer when attaching the copies throws', () => {
    const copies =
      preparation.companion?.kind === PackSceneCompanionKind.CatBorrow
        ? preparation.companion.copies
        : undefined;
    if (!copies) throw new Error('No copies');
    vi.spyOn(copies, 'attach').mockImplementation((layer) => {
      layer.append(document.createElement('span'));
      throw new Error('Snapshot is empty');
    });

    expect(created).toThrow('Snapshot is empty');
    disposers.reverse().forEach((dispose) => dispose());
    disposers.length = 0;
    expect(host.children).toHaveLength(0);
  });

  it('cancels when a borrowed button moved after it was measured', () => {
    let notifyResize: () => void = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notifyResize = callback;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    /* The button shifts between preparation and the renderer's creation. */
    place(page.send, 940, 410, 40, 40);
    created();
    notifyResize();

    expect(cancel).toHaveBeenCalledOnce();
  });

  it('removes the copy layer once when the session disposes it', () => {
    created();
    disposers.reverse().forEach((dispose) => dispose());
    disposers.length = 0;

    expect(host.children).toHaveLength(0);
    expect(cancel).not.toHaveBeenCalled();
  });
});

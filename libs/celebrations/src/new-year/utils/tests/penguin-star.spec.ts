import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  penguinArt,
  type StarProperty,
  type StarShape,
  type StarTransform,
} from '../penguin-star-art';
import { buildPenguinStarComposition } from '../penguin-star-composition';
import {
  getPenguinStarTargets,
  type PenguinStarTargets,
} from '../penguin-star-targets';

type Point = [number, number];
type Scene = ReturnType<typeof buildPenguinStarComposition>['animationData'];
type Layer = Scene['layers'][number];

const target = (width: number, rtl = false): PenguinStarTargets => {
  const stageWidth = Math.min(560, width - 32);
  const gap = width < 1280 ? 112 : 160;
  const direction = rtl ? -1 : 1;
  return {
    width,
    height: 900,
    rtl,
    box: {
      left: (width - stageWidth) / 2,
      top: 350,
      width: stageWidth,
      height: 100,
    },
    source: null,
    heading: null,
    modelSelector: null,
    center: width / 2 + (direction * gap) / 2,
    throwCenter: width / 2 - (direction * gap) / 2,
  };
};
const at = (property: StarProperty, seconds: number): number[] => {
  if (!property.a)
    return Array.isArray(property.k) ? property.k : [property.k as number];
  const keys = property.k as { t: number; s: number[] }[];
  const next = keys.findIndex((key) => key.t > seconds * 60);
  if (next < 0) return keys[keys.length - 1].s;
  if (!next) return keys[0].s;
  const from = keys[next - 1];
  const to = keys[next];
  /* Contact assertions use exact authored frames; interpolation only checks
     the held reaction and travel between those frames. */
  const progress = (seconds * 60 - from.t) / (to.t - from.t);
  return from.s.map((value, axis) => value + (to.s[axis] - value) * progress);
};
const transformed = (xy: Point, ks: StarTransform, seconds: number): Point => {
  const [x, y] = at(ks.p, seconds);
  const [sx, sy] = at(ks.s, seconds);
  const radians = (at(ks.r, seconds)[0] * Math.PI) / 180;
  return [
    x +
      ((xy[0] * sx) / 100) * Math.cos(radians) -
      ((xy[1] * sy) / 100) * Math.sin(radians),
    y +
      ((xy[0] * sx) / 100) * Math.sin(radians) +
      ((xy[1] * sy) / 100) * Math.cos(radians),
  ];
};
const getLayer = (data: Scene, name: string): Layer => {
  const layer = data.layers.find((item) => item.nm === name);
  if (!layer) throw new Error(`Missing ${name} layer`);
  return layer;
};
const hasGroup = (shapes: StarShape[], name: string): boolean =>
  shapes.some(
    (shape) =>
      shape.nm === name || (shape.it !== undefined && hasGroup(shape.it, name)),
  );
const world = (
  data: Scene,
  name: string,
  seconds: number,
  local: Point = [0, 0],
): Point => {
  let layer: Layer | undefined = getLayer(data, name);
  let position = local;
  while (layer) {
    position = transformed(position, layer.ks, seconds);
    layer =
      layer.parent === undefined
        ? undefined
        : data.layers.find((candidate) => candidate.ind === layer?.parent);
  }
  return position;
};
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const touching = (a: Point, b: Point) =>
  expect(distance(a, b)).toBeLessThan(1.5);
const starAt = (data: Scene, seconds: number): Point => {
  const active = data.layers.filter(
    (layer) =>
      layer.nm.includes('star') &&
      layer.nm !== 'snow-stage' &&
      layer.ip <= seconds * data.fr &&
      layer.op > seconds * data.fr,
  );
  expect(active).toHaveLength(1);
  return world(data, active[0].nm, seconds);
};

describe('Penguin star native choreography', () => {
  it.each([360, 900, 1280, 1920])(
    'keeps the complete vector story and resource budget at %ipx in both directions',
    (width) => {
      for (const rtl of [false, true]) {
        const { animationData: data } = buildPenguinStarComposition(
          target(width, rtl),
          width < 1280,
        );
        expect(data.op / data.fr).toBe(20);
        expect(data.assets).toEqual([]);
        expect(JSON.stringify(data).length).toBeLessThanOrEqual(120000);
        expect(data.layers.some((layer) => layer.nm === 'snow-stage')).toBe(
          true,
        );
        expect(data.layers.some((layer) => layer.nm === 'lever')).toBe(false);
        let animated = 0;
        const visit = (value: unknown) => {
          if (typeof value === 'number')
            expect(Number.isFinite(value)).toBe(true);
          if (!value || typeof value !== 'object') return;
          expect(value).not.toHaveProperty('ef');
          expect(value).not.toHaveProperty('masksProperties');
          if (
            'a' in value &&
            value.a === 1 &&
            'k' in value &&
            Array.isArray(value.k)
          ) {
            animated++;
            expect(value.k.length).toBeLessThanOrEqual(80);
            const times = value.k.map((key) => key.t);
            expect(times).toEqual([...times].sort((a, b) => a - b));
            expect(times.every((time) => time >= 0 && time <= data.op)).toBe(
              true,
            );
          }
          Object.values(value).forEach(visit);
        };
        visit(data);
        expect(animated).toBeLessThanOrEqual(32);
      }
    },
  );

  it.each([false, true])(
    'turns a crumpled interface fragment into a star and throws it onto the fir, rtl=%s',
    (rtl) => {
      const data = buildPenguinStarComposition(
        target(1280, rtl),
        false,
      ).animationData;
      const flipperTip = (seconds: number) =>
        world(data, 'penguin-flipper', seconds, [28, 0]);
      const handoffs: [from: string, to: string, seconds: number][] = [
        ['crumpled-interface', 'star-in-flipper', 7.6],
        ['star-in-flipper', 'thrown-star', 8.5],
        ['thrown-star', 'star-on-fir', 10.7],
      ];
      for (const [from, to, seconds] of handoffs) {
        expect(getLayer(data, from).op).toBe(seconds * data.fr);
        expect(getLayer(data, to).ip).toBe(seconds * data.fr);
        touching(world(data, from, seconds), world(data, to, seconds));
      }
      touching(world(data, 'crumpled-interface', 6.8), flipperTip(6.8));
      touching(starAt(data, 7.7), flipperTip(7.7));
      expect(distance(starAt(data, 9.2), flipperTip(9.2))).toBeGreaterThan(40);
      expect(data.layers.some((layer) => layer.nm === 'star-on-hat')).toBe(
        false,
      );
      touching(starAt(data, 10.8), world(data, 'fir-tree', 10.8, [0, -148]));
      touching(starAt(data, 11.8), world(data, 'fir-tree', 11.8, [0, -148]));
      expect(starAt(data, 13.6)).toEqual(world(data, 'star-on-fir', 13.6));
    },
  );

  it.each([360, 1280])(
    'keeps the penguin opposite the fir at both throw releases on %ipx in LTR and RTL',
    (width) => {
      for (const rtl of [false, true]) {
        const targets = target(width, rtl);
        const data = buildPenguinStarComposition(
          targets,
          width === 360,
        ).animationData;
        const required = width === 360 ? 112 : 160;
        expect(
          Math.abs(targets.center - targets.throwCenter),
        ).toBeGreaterThanOrEqual(required);
        for (const seconds of [5.1, 8.5]) {
          const treeX = world(data, 'fir-tree', seconds)[0];
          const penguinX = world(data, 'penguin', seconds)[0];
          expect(Math.abs(treeX - penguinX)).toBeGreaterThanOrEqual(required);
          expect(rtl ? penguinX > treeX : penguinX < treeX).toBe(true);
        }
      }
    },
  );

  it.each([false, true])(
    'provides a measured handoff point for a borrowed control, rtl=%s',
    (rtl) => {
      const targets = target(360, rtl);
      const rect = new DOMRect(targets.center - 30, 375, 60, 40);
      targets.modelSelector = {
        element: document.createElement('button'),
        rect,
      };
      targets.borrowed = targets.modelSelector;
      const plan = buildPenguinStarComposition(targets, true);
      expect(plan.capturePoint[0]).toBeGreaterThan(0);
      expect(plan.capturePoint[0]).toBeLessThan(360);
      expect(plan.capturePoint[1]).toBeGreaterThan(200);
      expect(plan.capturePoint[1]).toBeLessThan(900);
      touching(
        starAt(plan.animationData, 10.8),
        world(plan.animationData, 'fir-tree', 10.8, [0, -148]),
      );
    },
  );

  it.each([false, true])(
    'keeps the fir and pot planted while the penguin tries twice, bows and leaves alone, rtl=%s',
    (rtl) => {
      const data = buildPenguinStarComposition(
        target(1280, rtl),
        false,
      ).animationData;
      const flipper = getLayer(data, 'penguin-flipper');
      const penguin = getLayer(data, 'penguin');
      const tree = getLayer(data, 'fir-tree');
      const pot = getLayer(data, 'fir-pot');
      expect(tree.ip).toBe(0);
      expect(pot.ip).toBe(0);
      expect(at(tree.ks.o, 0)[0]).toBe(100);
      expect(at(pot.ks.o, 0)[0]).toBe(100);
      expect(at(penguin.ks.o, 0)[0]).toBe(0);
      for (const seconds of [0, 4, 5.4, 8.5, 10, 13.5, 16, 20]) {
        touching(world(data, tree.nm, seconds), world(data, tree.nm, 0));
        touching(world(data, pot.nm, seconds), world(data, pot.nm, 0));
      }
      expect(Math.abs(at(flipper.ks.r, 8.5)[0])).toBeGreaterThan(
        Math.abs(at(flipper.ks.r, 6.7)[0]),
      );
      expect(
        distance(world(data, 'penguin', 10.5), world(data, 'penguin', 11.5)),
      ).toBeLessThan(1);
      expect(Math.abs(at(tree.ks.r, 13.5)[0])).toBeGreaterThanOrEqual(10);
      expect(at(pot.ks.r, 13.5)[0]).toBe(0);
      touching(world(data, pot.nm, 13.5), world(data, tree.nm, 13.5));
      expect(Math.abs(at(penguin.ks.r, 15.1)[0])).toBeGreaterThan(5);
      expect(Math.abs(at(penguin.ks.r, 16)[0])).toBeLessThan(1);
      expect(
        distance(world(data, penguin.nm, 16), world(data, penguin.nm, 19)),
      ).toBeGreaterThan(40);
    },
  );

  it('keeps a named Christmas hat on the monochrome penguin', () => {
    expect(hasGroup(penguinArt(), 'santa-hat')).toBe(true);
    const data = buildPenguinStarComposition(target(360), true).animationData;
    expect(hasGroup(getLayer(data, 'penguin').shapes, 'santa-hat')).toBe(true);
  });

  it.each([false, true])(
    'enters directly from the side at stage height and leaves by that side, rtl=%s',
    (rtl) => {
      const targets = target(360, rtl);
      targets.box = { left: 16, top: 423, width: 328, height: 90 };
      const data = buildPenguinStarComposition(targets, true).animationData;
      const sideX = rtl ? 344 + 60 * 0.68 : 16 - 60 * 0.68;
      const start = world(data, 'penguin', 0);
      const end = world(data, 'penguin', 20);
      expect(start[0]).toBeCloseTo(sideX, 1);
      touching(start, end);
      for (const seconds of [0, 1, 2, 3, 4]) {
        const [x, y] = world(data, 'penguin', seconds);
        expect(y).toBeGreaterThan(417);
        expect(y).toBeLessThan(427);
        expect(rtl ? x < start[0] : x > start[0]).toBe(seconds > 0);
      }
      expect(world(data, 'penguin', 4)[0]).toBeCloseTo(targets.throwCenter, 1);
    },
  );
});

describe('Penguin star read-only staging', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  const setup = (width: number, rtl: boolean, headingRect: DOMRect) => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      width,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      900,
    );
    const region = document.createElement('section');
    region.setAttribute('role', 'region');
    const heading = document.createElement('h1');
    heading.textContent = 'Good evening';
    const composer = document.createElement('div');
    composer.className = 'composer';
    composer.style.direction = rtl ? 'rtl' : 'ltr';
    const draft = document.createElement('textarea');
    draft.value = 'Keep this draft';
    const button = document.createElement('button');
    button.className = 'model';
    button.textContent = 'Model';
    Object.defineProperty(button, 'animate', {
      configurable: true,
      value: vi.fn(() => ({ cancel: vi.fn() })),
    });
    composer.append(draft, button);
    region.append(heading, composer);
    document.body.append(region);
    const composerRect = new DOMRect(16, 350, width - 32, 100);
    vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(composerRect);
    vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue(headingRect);
    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(rtl ? 66 : width - 120, 380, 60, 40),
    );
    const anchors = { composer: 'composer', composerModelSelector: 'model' };
    return { composer, composerRect, heading, button, draft, anchors };
  };

  it.each([false, true])(
    'measures two 360px throwing positions and an idle selector without altering controls, rtl=%s',
    (rtl) => {
      const headingRect = new DOMRect(130, 100, 100, 40);
      const { composer, heading, button, draft, anchors } = setup(
        360,
        rtl,
        headingRect,
      );
      const before = composer.outerHTML;
      const buttonRead = vi.spyOn(button, 'getBoundingClientRect');
      const targets = getPenguinStarTargets(anchors, true);
      expect(targets.source?.element).toBe(composer);
      expect(targets.heading?.element).toBe(heading);
      expect(targets.modelSelector?.element).toBe(button);
      expect(targets.borrowed?.element).toBe(button);
      expect(
        Math.abs(targets.center - targets.throwCenter),
      ).toBeGreaterThanOrEqual(112);
      expect(
        rtl
          ? targets.throwCenter > targets.center
          : targets.throwCenter < targets.center,
      ).toBe(true);
      expect(buttonRead).toHaveBeenCalled();
      expect(composer.outerHTML).toBe(before);
      expect(draft.value).toBe('Keep this draft');
    },
  );

  it('uses a decorative stage but retains a reachable selector when heading blocks the sweep', () => {
    const { composer, composerRect, button, anchors } = setup(
      360,
      true,
      new DOMRect(40, 245, 280, 50),
    );
    const before = composer.outerHTML;
    const targets = getPenguinStarTargets(anchors, true);
    expect(targets.source).toBeNull();
    expect(targets.modelSelector?.element).toBe(button);
    expect(targets.box.top).toBeGreaterThan(composerRect.bottom);
    expect(
      Math.abs(targets.center - targets.throwCenter),
    ).toBeGreaterThanOrEqual(112);
    expect(
      buildPenguinStarComposition(targets, true).animationData.layers.some(
        (layer) => layer.nm === 'snow-stage',
      ),
    ).toBe(true);
    expect(composer.outerHTML).toBe(before);
  });

  it('moves to a decorative stage when starter prompts block the throwing sweep', () => {
    const { composer, button, anchors } = setup(
      360,
      false,
      new DOMRect(130, 100, 100, 40),
    );
    const starters = document.createElement('div');
    starters.className = 'starters';
    const suggestion = document.createElement('button');
    suggestion.textContent = 'Plan a trip';
    const nearer = document.createElement('button');
    nearer.textContent = 'Write a poem';
    Object.defineProperty(suggestion, 'animate', {
      configurable: true,
      value: vi.fn(() => ({ cancel: vi.fn() })),
    });
    vi.spyOn(suggestion, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(24, 250, 100, 40),
    );
    Object.defineProperty(nearer, 'animate', {
      configurable: true,
      value: vi.fn(() => ({ cancel: vi.fn() })),
    });
    vi.spyOn(nearer, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(160, 250, 100, 40),
    );
    starters.append(suggestion, nearer);
    composer.parentElement?.append(starters);
    vi.spyOn(starters, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(24, 245, 312, 55),
    );
    const targets = getPenguinStarTargets(
      { ...anchors, starterList: 'starters' },
      true,
    );
    expect(targets.starters?.element).toBe(starters);
    expect(targets.borrowed?.element).toBe(nearer);
    expect(targets.source).toBeNull();
    expect(targets.modelSelector?.element).toBe(button);
    expect(
      Math.abs(targets.center - targets.throwCenter),
    ).toBeGreaterThanOrEqual(112);
    expect(
      buildPenguinStarComposition(targets, true).animationData.layers.some(
        (layer) => layer.nm === 'snow-stage',
      ),
    ).toBe(true);
  });

  it.each([
    'focused',
    'disabled',
    'expanded',
    'editable',
    'hidden',
    'oversized',
    'transformed',
    'no-animation',
  ])('skips an unsafe %s model selector', (mode) => {
    const { button, anchors } = setup(
      360,
      false,
      new DOMRect(130, 100, 100, 40),
    );
    if (mode === 'focused') button.focus();
    if (mode === 'disabled') button.disabled = true;
    if (mode === 'expanded') button.setAttribute('aria-expanded', 'true');
    if (mode === 'editable') button.setAttribute('contenteditable', 'true');
    if (mode === 'hidden') button.style.display = 'none';
    if (mode === 'oversized')
      vi.mocked(button.getBoundingClientRect).mockReturnValue(
        new DOMRect(240, 380, 181, 40),
      );
    if (mode === 'transformed') button.style.transform = 'rotate(2deg)';
    if (mode === 'no-animation') Reflect.deleteProperty(button, 'animate');
    expect(getPenguinStarTargets(anchors, true).modelSelector).toBeNull();
  });

  it('checks only four selector candidates and can use a later eligible one', () => {
    const { composer, button, anchors } = setup(
      360,
      false,
      new DOMRect(130, 100, 100, 40),
    );
    button.disabled = true;
    const candidate = document.createElement('button');
    candidate.className = 'model';
    candidate.textContent = 'Eligible model';
    Object.defineProperty(candidate, 'animate', {
      configurable: true,
      value: vi.fn(() => ({ cancel: vi.fn() })),
    });
    vi.spyOn(candidate, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(240, 380, 60, 40),
    );
    composer.append(candidate);
    expect(getPenguinStarTargets(anchors, true).modelSelector?.element).toBe(
      candidate,
    );
    for (let index = 0; index < 3; index++) {
      const disabled = document.createElement('button');
      disabled.className = 'model';
      disabled.disabled = true;
      composer.insertBefore(disabled, candidate);
    }
    expect(getPenguinStarTargets(anchors, true).modelSelector).toBeNull();
  });

  it('keeps the full decorative story when the composer is unavailable', () => {
    const { anchors } = setup(360, false, new DOMRect(130, 245, 100, 50));
    const targets = getPenguinStarTargets(
      { ...anchors, composer: 'missing' },
      true,
    );
    expect(targets.source).toBeNull();
    expect(buildPenguinStarComposition(targets, true).animationData.op).toBe(
      1200,
    );
  });
});

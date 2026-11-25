import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resetSnowmanFixture,
  stubAnimate,
} from '../../../test-utils/snowman-fixtures';
import { CatBaubleMode } from '../../types/new-year';
import { toToyKeyframes } from '../cat-bauble-animation';
import { TANGERINE_RADIUS } from '../cat-bauble-art';
import {
  buildCatBaubleComposition,
  CAT_BAUBLE_BEATS as B,
  CAT_BAUBLE_MS,
  type CatBaubleComposition,
} from '../cat-bauble-composition';
import {
  CAT_BAUBLE_SCALE,
  catReach,
  getCatBaubleTargets,
} from '../cat-bauble-targets';

type Point = [number, number];

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const FPS = 60;
const END = CAT_BAUBLE_MS / 1000;
const ANCHORS = { composer: 'composer', composerModelSelector: 'model' };
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const frames = (t0: number, t1: number) =>
  Array.from(
    { length: Math.floor((t1 - t0) * FPS) + 1 },
    (_, i) => t0 + i / FPS,
  );
const place = (element: Element, { left, top, width, height }: Box) =>
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(left, top, width, height),
  });
const viewport = (width: number, height: number) => {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    get: () => height,
  });
};

interface Fixture {
  width?: number;
  height?: number;
  rtl?: boolean;
  composer?: Box | null;
  selector?: Box | null;
}

/** A composer with a model selector inside, measured where the boxes say. */
const buildFixture = ({
  width = 1280,
  height = 900,
  rtl = false,
  composer = { left: 360, top: 420, width: 560, height: 68 },
  selector = { left: 760, top: 432, width: 72, height: 40 },
}: Fixture = {}) => {
  viewport(width, height);
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  if (!composer) return null;
  const input = document.createElement('div');
  input.className = 'composer';
  input.style.direction = rtl ? 'rtl' : 'ltr';
  document.body.append(input);
  place(input, composer);
  if (!selector) return null;
  const button = document.createElement('button');
  button.className = 'model';
  button.textContent = 'Model';
  input.append(button);
  place(button, selector);
  return button;
};

const mobileFixture = (rtl = false): Fixture => ({
  width: 375,
  height: 760,
  rtl,
  composer: { left: 16, top: 360, width: 343, height: 96 },
  selector: rtl
    ? { left: 70, top: 392, width: 64, height: 36 }
    : { left: 241, top: 392, width: 64, height: 36 },
});

describe('cat bauble', () => {
  beforeEach(() => stubAnimate());
  afterEach(() => resetSnowmanFixture());

  describe('targets', () => {
    it('borrows the model selector and puts the fir at the far end', () => {
      const button = buildFixture();
      const targets = getCatBaubleTargets(ANCHORS, false);
      expect(targets.mode).toBe(CatBaubleMode.Selector);
      expect(targets.selector?.element).toBe(button);
      expect(targets.floor).toBe(417);
      expect(targets.scale).toBe(CAT_BAUBLE_SCALE.desktop);
      /* The selector sits past the middle, so the fir stands at the start. */
      expect(targets.toward).toBe(-1);
      expect(targets.firA).toBeLessThan(targets.toyA);
      expect(targets.watched).toEqual([
        document.querySelector('.composer'),
        button,
      ]);
    });

    it('uses logical edges in RTL', () => {
      buildFixture({
        rtl: true,
        selector: { left: 400, top: 432, width: 72, height: 40 },
      });
      const targets = getCatBaubleTargets(ANCHORS, false);
      expect(targets.dir).toBe(-1);
      expect(targets.startEdge).toBe(920);
      expect(targets.mode).toBe(CatBaubleMode.Selector);
      expect(targets.toward).toBe(-1);
    });

    it.each([
      ['focused', (button: HTMLElement) => button.focus(), {}],
      [
        'expanded',
        (button: HTMLElement) => button.setAttribute('aria-expanded', 'true'),
        {},
      ],
      [
        'too wide',
        () => undefined,
        { selector: { left: 700, top: 432, width: 160, height: 40 } },
      ],
      [
        'too tall',
        () => undefined,
        { selector: { left: 700, top: 420, width: 72, height: 60 } },
      ],
      [
        'out of reach',
        () => undefined,
        {
          composer: { left: 360, top: 420, width: 560, height: 200 },
          selector: { left: 760, top: 560, width: 72, height: 40 },
        },
      ],
    ] as [string, (button: HTMLElement) => void, Fixture][])(
      'plays with a tangerine when the selector is %s',
      (_, prepare, fixture) => {
        const button = buildFixture(fixture);
        if (button) prepare(button);
        const targets = getCatBaubleTargets(ANCHORS, false);
        expect(targets.mode).toBe(CatBaubleMode.Tangerine);
        expect(targets.selector).toBeNull();
        expect(targets.toyWidth).toBeCloseTo(
          TANGERINE_RADIUS * 2 * targets.scale,
          6,
        );
      },
    );

    it('shows the still without an eligible composer or headroom', () => {
      buildFixture({ composer: null });
      expect(getCatBaubleTargets(ANCHORS, false).mode).toBe(
        CatBaubleMode.Static,
      );
      resetSnowmanFixture();
      buildFixture({
        composer: { left: 360, top: 120, width: 560, height: 68 },
      });
      expect(getCatBaubleTargets(ANCHORS, false).mode).toBe(
        CatBaubleMode.Static,
      );
    });

    it('reaches further on desktop than on mobile', () => {
      expect(catReach(CAT_BAUBLE_SCALE.desktop)).toBeGreaterThan(
        catReach(CAT_BAUBLE_SCALE.mobile),
      );
    });
  });

  describe.each([
    { name: 'desktop LTR', isMobile: false, fixture: {} as Fixture },
    {
      name: 'desktop LTR, selector at the start',
      isMobile: false,
      fixture: { selector: { left: 420, top: 432, width: 72, height: 40 } },
    },
    { name: 'desktop RTL', isMobile: false, fixture: { rtl: true } },
    { name: 'mobile LTR', isMobile: true, fixture: mobileFixture() },
    { name: 'mobile RTL', isMobile: true, fixture: mobileFixture(true) },
  ])('$name with the model selector', ({ isMobile, fixture }) => {
    let composition: CatBaubleComposition;
    beforeEach(() => {
      buildFixture(fixture);
      const targets = getCatBaubleTargets(ANCHORS, isMobile);
      expect(targets.mode).toBe(CatBaubleMode.Selector);
      composition = buildCatBaubleComposition(targets, isMobile);
    });

    it('misses the bauble at the pounce apex', () => {
      const { probe, targets } = composition;
      const at = probe(B.apex);
      expect(distance(at.paw, at.bauble)).toBeGreaterThan(
        4.5 * 1.35 * targets.scale,
      );
    });

    it('puts the paw on the selector top before the copy moves', () => {
      const { probe, targets, toyFrames, toyHideAt } = composition;
      const rect = targets.selector?.rect as DOMRect;
      const at = probe(B.hook);
      expect(
        distance(at.paw, [(rect.left + rect.right) / 2, rect.top]),
      ).toBeLessThan(2);
      for (const frame of toyFrames.filter((f) => f.offset <= toyHideAt)) {
        expect(Math.abs(frame.dx)).toBeLessThan(1e-6);
        expect(Math.abs(frame.dy)).toBeLessThan(1e-6);
      }
    });

    it('keeps its feet on or above the rim', () => {
      const { probe, targets } = composition;
      for (const t of frames(0, B.exitEnd))
        expect(probe(t).feet[1]).toBeLessThanOrEqual(targets.floor + 0.6);
    });

    it('slides the copy on the rim into the trunk', () => {
      const { probe, targets } = composition;
      for (const t of frames(B.swat, B.impact))
        expect(probe(t).toyBottom).toBeCloseTo(targets.floor, 5);
      const hit = probe(B.impact);
      expect(Math.abs(hit.toyLead - hit.trunkFace)).toBeLessThan(2);
    });

    it('hangs the copy from the hook by its grip until the bite', () => {
      const { probe } = composition;
      for (const t of frames(B.impact + 0.42, B.bite - 0.02)) {
        const at = probe(t);
        expect(distance(at.toyGrip, at.hook)).toBeLessThan(1);
      }
      const bite = probe(B.bite);
      expect(distance(bite.mouth, bite.hook)).toBeLessThan(2);
    });

    it('carries the copy by its grip in the mouth unless it rests on the rim', () => {
      const { probe, targets } = composition;
      for (const t of frames(B.bite, B.lower)) {
        const at = probe(t);
        if (at.toyBottom < targets.floor - 0.01)
          expect(distance(at.mouth, at.toyGrip)).toBeLessThan(2.5);
        else expect(Math.abs(at.toyBottom - targets.floor)).toBeLessThan(0.5);
      }
    });

    it('returns the copy to its exact rect and keeps the WAAPI track valid', () => {
      const { toyFrames, toyHideAt, toyRestoreAt } = composition;
      expect(toyHideAt).toBeCloseTo(B.hook / END, 9);
      expect(toyRestoreAt).toBeCloseTo(B.restore / END, 9);
      const offsets = toyFrames.map(({ offset }) => offset);
      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      expect(offsets[0]).toBe(0);
      expect(offsets.at(-1)).toBe(1);
      for (const frame of toyFrames.filter((f) => f.offset >= toyRestoreAt)) {
        expect(frame.dx).toBe(0);
        expect(frame.dy).toBe(0);
        expect(frame.rotate).toBe(0);
      }
      const slotted = composition.probe(B.slotted + 0.01);
      expect(Math.abs(slotted.toy.rotation) % 360).toBeLessThan(1e-6);
      const shown = toyFrames.filter(({ opacity }) => opacity === 1);
      expect(shown[0].offset).toBeLessThan(toyHideAt - 0.01);
      expect(shown.at(-1)?.offset).toBeGreaterThanOrEqual(toyRestoreAt + 0.04);
      const keyframes = toToyKeyframes(toyFrames);
      expect(keyframes).toHaveLength(toyFrames.length);
      for (const { transform } of keyframes)
        expect(String(transform)).not.toMatch(/scale/);
    });

    it('stays inside its budgets', () => {
      const { animationData } = composition;
      expect(animationData.layers.length).toBeLessThanOrEqual(8);
      const json = JSON.stringify(animationData);
      expect(json.length).toBeLessThan(isMobile ? 130_000 : 180_000);
      let animated = 0;
      let keys = 0;
      let maxKeys = 0;
      let drawn = 0;
      const visit = (value: unknown) => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== 'object') return;
        const node = value as Record<string, unknown>;
        if (node.a === 1 && Array.isArray(node.k)) {
          animated++;
          keys += node.k.length;
          maxKeys = Math.max(maxKeys, node.k.length);
          return;
        }
        if (['gr', 'el', 'rc', 'sh'].includes(node.ty as string)) drawn++;
        Object.values(node).forEach(visit);
      };
      visit(animationData.layers);
      expect(animated).toBeLessThanOrEqual(isMobile ? 48 : 60);
      expect(keys).toBeLessThanOrEqual(1400);
      expect(maxKeys).toBeLessThanOrEqual(160);
      expect(drawn).toBeLessThanOrEqual(200);
      expect(json).not.toMatch(/"ty":"(gf|gs|im)"|"masksProperties"|"ef"/);
      for (const layer of animationData.layers) {
        expect(layer.ip).toBeGreaterThanOrEqual(0);
        expect(layer.op).toBeLessThanOrEqual(END * FPS);
      }
    });
  });

  it('plays the same story with a tangerine and borrows nothing', () => {
    buildFixture({ selector: null });
    const targets = getCatBaubleTargets(ANCHORS, false);
    expect(targets.mode).toBe(CatBaubleMode.Tangerine);
    const composition = buildCatBaubleComposition(targets, false);
    expect(composition.toyFrames).toEqual([]);
    expect(composition.animationData.layers.map(({ nm }) => nm)).toContain(
      'tangerine',
    );
    const { probe } = composition;
    const hit = probe(B.impact);
    expect(Math.abs(hit.toyLead - hit.trunkFace)).toBeLessThan(2);
    for (const t of frames(B.impact + 0.42, B.bite - 0.02))
      expect(distance(probe(t).toyGrip, probe(t).hook)).toBeLessThan(1);
    const slotted = probe(B.restore);
    expect(slotted.toyBottom).toBeCloseTo(targets.floor, 5);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resetSnowmanFixture,
  stubAnimate,
} from '../../../test-utils/snowman-fixtures';
import { ElfFireworksMode } from '../../types/new-year';
import { toButtonKeyframes } from '../elf-fireworks-animation';
import {
  BURST_LIFE_S,
  buildElfFireworksComposition,
  ELF_FIREWORKS_BEATS as B,
  ELF_FIREWORKS_MS,
  ELF_FIREWORKS_ROCKETS,
  ELF_FIREWORKS_SPARKS,
  type ElfFireworksComposition,
} from '../elf-fireworks-composition';
import {
  ELF_FIREWORKS_SCALE,
  getElfFireworksTargets,
} from '../elf-fireworks-targets';
import { elfPalm, elfReach } from '../gift-wrapping-rig';

type Point = [number, number];

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const FPS = 60;
const END = ELF_FIREWORKS_MS / 1000;
const ANCHORS = { composer: 'composer' };
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
  buttons?: Box[];
}

/** A composer with buttons inside, measured where the boxes say. */
const buildFixture = ({
  width = 1280,
  height = 900,
  rtl = false,
  composer = { left: 360, top: 420, width: 560, height: 68 },
  buttons = [
    { left: 372, top: 432, width: 44, height: 44 },
    { left: 800, top: 432, width: 56, height: 44 },
    { left: 864, top: 432, width: 44, height: 44 },
  ],
}: Fixture = {}) => {
  viewport(width, height);
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  const created: HTMLButtonElement[] = [];
  if (!composer) return created;
  const input = document.createElement('div');
  input.className = 'composer';
  input.style.direction = rtl ? 'rtl' : 'ltr';
  document.body.append(input);
  place(input, composer);
  for (const box of buttons) {
    const button = document.createElement('button');
    button.textContent = 'Go';
    input.append(button);
    place(button, box);
    created.push(button);
  }
  return created;
};

const mobileFixture = (rtl = false): Fixture => ({
  width: 375,
  height: 760,
  rtl,
  composer: { left: 16, top: 360, width: 343, height: 96 },
  buttons: rtl
    ? [
        { left: 28, top: 408, width: 36, height: 36 },
        { left: 311, top: 408, width: 36, height: 36 },
      ]
    : [
        { left: 28, top: 408, width: 36, height: 36 },
        { left: 311, top: 408, width: 36, height: 36 },
      ],
});

describe('elf fireworks', () => {
  beforeEach(() => stubAnimate());
  afterEach(() => resetSnowmanFixture());

  describe('targets', () => {
    it('borrows the inline-end-most composer button', () => {
      const buttons = buildFixture();
      const targets = getElfFireworksTargets(ANCHORS, false);
      expect(targets.mode).toBe(ElfFireworksMode.Button);
      expect(targets.button?.element).toBe(buttons[2]);
      expect(targets.floor).toBe(417);
      expect(targets.scale).toBe(ELF_FIREWORKS_SCALE.desktop);
      expect(targets.watched).toEqual([
        document.querySelector('.composer'),
        buttons[2],
      ]);
    });

    it('borrows the leftmost button in RTL', () => {
      const buttons = buildFixture({ rtl: true });
      const targets = getElfFireworksTargets(ANCHORS, false);
      expect(targets.dir).toBe(-1);
      expect(targets.startEdge).toBe(920);
      expect(targets.button?.element).toBe(buttons[0]);
    });

    it('draws a detonator when the end button is focused or too far from the end', () => {
      const buttons = buildFixture();
      buttons[2].focus();
      expect(getElfFireworksTargets(ANCHORS, false).mode).toBe(
        ElfFireworksMode.Detonator,
      );
      resetSnowmanFixture();
      buildFixture({
        buttons: [{ left: 372, top: 432, width: 44, height: 44 }],
      });
      const targets = getElfFireworksTargets(ANCHORS, false);
      expect(targets.mode).toBe(ElfFireworksMode.Detonator);
      expect(targets.button).toBeNull();
    });

    it('draws a detonator when the cane cannot reach the button', () => {
      buildFixture({
        composer: { left: 360, top: 400, width: 560, height: 250 },
        buttons: [{ left: 864, top: 600, width: 44, height: 44 }],
      });
      expect(getElfFireworksTargets(ANCHORS, false).mode).toBe(
        ElfFireworksMode.Detonator,
      );
    });

    it('shows the still without an eligible composer', () => {
      buildFixture({ composer: null });
      expect(getElfFireworksTargets(ANCHORS, false).mode).toBe(
        ElfFireworksMode.Static,
      );
      resetSnowmanFixture();
      buildFixture({
        composer: { left: 360, top: 60, width: 560, height: 68 },
      });
      expect(getElfFireworksTargets(ANCHORS, false).mode).toBe(
        ElfFireworksMode.Static,
      );
    });
  });

  it('reaches its arm targets and reproduces the palm', () => {
    for (const target of [
      [40, -40],
      [20, -20],
      [5, -80],
    ] as Point[]) {
      expect(distance(elfPalm(...elfReach(target)), target)).toBeLessThan(1e-6);
    }
  });

  describe.each([
    { name: 'desktop LTR', isMobile: false, fixture: {} as Fixture },
    { name: 'desktop RTL', isMobile: false, fixture: { rtl: true } },
    { name: 'mobile LTR', isMobile: true, fixture: mobileFixture() },
    { name: 'mobile RTL', isMobile: true, fixture: mobileFixture(true) },
  ])('$name with the send button', ({ isMobile, fixture }) => {
    let composition: ElfFireworksComposition;
    beforeEach(() => {
      buildFixture(fixture);
      const targets = getElfFireworksTargets(ANCHORS, isMobile);
      expect(targets.mode).toBe(ElfFireworksMode.Button);
      composition = buildElfFireworksComposition(targets, isMobile);
    });

    it('hooks the button top with the cane before the copy moves', () => {
      const { probe, targets } = composition;
      const at = probe(B.hook);
      expect(at.hook).not.toBeNull();
      expect(distance(at.hook as Point, at.buttonTop)).toBeLessThan(1.5);
      const rect = targets.button?.rect as DOMRect;
      expect(at.buttonTop[1]).toBeCloseTo(rect.top, 5);
    });

    it('presses the landed button by hand, then stands on it', () => {
      const { probe, targets } = composition;
      const pressed = probe(B.press);
      expect(distance(pressed.hand, pressed.buttonTop)).toBeLessThan(2);
      expect(pressed.button.scaleY).toBeCloseTo(0.88, 5);
      for (const t of [
        B.stomp + 0.08,
        B.stomp + 0.95 + 0.44,
        B.stomp + 1.55 + 0.44,
        B.hopOff,
      ]) {
        const on = probe(t);
        expect(Math.abs(on.feet[1] - on.buttonTop[1])).toBeLessThan(1.5);
        expect(Math.abs(on.feet[0] - on.button.center[0])).toBeLessThan(1);
      }
      expect(probe(B.stomp + 0.08).button.scaleY).toBeCloseTo(0.72, 5);
      expect(probe(B.landed + 0.3).buttonTop[1]).toBeCloseTo(
        targets.floor - (targets.button?.rect.height ?? 0),
        5,
      );
    });

    it('keeps his boots on or above the rim, except while hanging off the screen', () => {
      const { probe, targets } = composition;
      for (const t of frames(0, END)) {
        expect(probe(t).feet[1]).toBeLessThanOrEqual(targets.floor + 0.6);
      }
    });

    it('holds the dud by its grip during the ride', () => {
      const { probe } = composition;
      for (const t of frames(B.dudFires, B.dudExit)) {
        const at = probe(t);
        expect(distance(at.hand, at.dudGrip)).toBeLessThan(2.5);
      }
    });

    it('lands the hat on the rim and puts it back on his head', () => {
      const { probe, targets } = composition;
      const s = targets.scale;
      expect(probe(B.hatLands).hat?.[1]).toBeCloseTo(targets.floor - 17 * s, 5);
      expect(probe(B.hatOn - 0.01).hat).not.toBeNull();
      expect(probe(B.hatOn).hat).toBeNull();
    });

    it('returns the copy to its exact rect and keeps the WAAPI track valid', () => {
      const { buttonFrames, buttonHideAt, buttonRestoreAt } = composition;
      expect(buttonHideAt).toBeCloseTo(B.hook / END, 9);
      expect(buttonRestoreAt).toBeCloseTo(B.restore / END, 9);
      const offsets = buttonFrames.map(({ offset }) => offset);
      expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      expect(offsets[0]).toBe(0);
      expect(offsets.at(-1)).toBe(1);
      const restored = buttonFrames.filter(
        ({ offset }) => offset >= buttonRestoreAt,
      );
      for (const frame of restored) {
        expect(Math.abs(frame.dx)).toBeLessThan(1e-6);
        expect(Math.abs(frame.dy)).toBeLessThan(1e-6);
        expect(frame.scaleY).toBe(1);
        expect(Math.abs(frame.rotate) % 360).toBeLessThan(1e-6);
      }
      /* Shown before the original fades and until it has faded back in. */
      const shown = buttonFrames.filter(({ opacity }) => opacity === 1);
      expect(shown[0].offset).toBeLessThan(buttonHideAt - 0.01);
      expect(shown.at(-1)?.offset).toBeGreaterThanOrEqual(
        buttonRestoreAt + 0.04,
      );
      expect(toButtonKeyframes(buttonFrames)).toHaveLength(buttonFrames.length);
    });

    it('stays inside its budgets', () => {
      const { animationData, bursts, launches, targets } = composition;
      const layout = isMobile ? 'mobile' : 'desktop';
      expect(launches).toHaveLength(ELF_FIREWORKS_ROCKETS[layout]);
      expect(bursts).toHaveLength(ELF_FIREWORKS_ROCKETS[layout] + 1);
      const sparks = bursts.reduce((sum, burst) => sum + burst.sparks, 0);
      expect(sparks).toBeLessThanOrEqual(isMobile ? 36 : 78);
      expect(bursts.at(-1)?.sparks).toBe(ELF_FIREWORKS_SPARKS[layout].finale);
      expect(animationData.layers.length).toBeLessThanOrEqual(17);
      expect(JSON.stringify(animationData).length).toBeLessThan(
        isMobile ? 150_000 : 220_000,
      );
      for (const { center, radius, t } of bursts) {
        expect(center[0] - radius).toBeGreaterThanOrEqual(0);
        expect(center[0] + radius).toBeLessThanOrEqual(targets.width);
        expect(center[1]).toBeLessThan(targets.floor - 100);
        expect(t + BURST_LIFE_S).toBeLessThanOrEqual(END);
      }
      /* Every layer ends inside the playback. */
      for (const layer of animationData.layers) {
        expect(layer.ip).toBeGreaterThanOrEqual(0);
        expect(layer.op).toBeLessThanOrEqual(END * FPS);
      }
    });
  });

  it('draws a detonator instead of borrowing a button', () => {
    buildFixture({ buttons: [] });
    const targets = getElfFireworksTargets(ANCHORS, false);
    const composition = buildElfFireworksComposition(targets, false);
    expect(composition.buttonFrames).toEqual([]);
    const names = composition.animationData.layers.map(({ nm }) => nm);
    expect(names).toContain('detonator');
    const pressed = composition.probe(B.press);
    expect(distance(pressed.hand, pressed.buttonTop)).toBeLessThan(2);
    const on = composition.probe(B.stomp + 0.08);
    expect(Math.abs(on.feet[1] - on.buttonTop[1])).toBeLessThan(1.5);
  });
});

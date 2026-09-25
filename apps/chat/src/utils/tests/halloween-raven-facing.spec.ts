import { describe, expect, it } from 'vitest';
import {
  buildRavenPlan,
  ravenFacingFrames,
  RAVEN_GRAB,
  type RavenBird,
  type RavenFacingFrame,
} from '../halloween-raven-plan';
import type { RavenSurface, RavenTargets } from '../halloween-raven-targets';

const surface = (
  left: number,
  top: number,
  width: number,
  height: number,
): RavenSurface => ({
  rect: new DOMRect(left, top, width, height),
  element: document.createElement('div'),
  color: '#aaa',
  background: '#111',
});

const targets = (rtl: boolean): RavenTargets => {
  const composer = surface(340, 400, 800, 150);
  const conversation = surface(rtl ? 1020 : 20, 150, 240, 40);
  return {
    width: 1280,
    height: 800,
    composer,
    conversation,
    pumpkin: surface(rtl ? 20 : 1130, 570, 128, 128),
    fragments: [],
    edges: [composer, conversation],
  };
};

const headingDuring = (bird: RavenBird, from: number, to: number) => {
  const middle = (from + to) / 2;
  const heading = ravenFacingFrames(bird)
    .filter(({ offset }) => offset <= middle)
    .at(-1);
  expect(heading).toBeDefined();
  return heading!;
};

const alignment = (
  heading: RavenFacingFrame,
  dx: number,
  dy: number,
  localX = 1,
  localY = 0,
) => {
  const radians = (heading.rotation * Math.PI) / 180;
  const x = heading.facing * localX;
  const worldX = x * Math.cos(radians) - localY * Math.sin(radians);
  const worldY = x * Math.sin(radians) + localY * Math.cos(radians);
  return (
    (worldX * dx + worldY * dy) /
    (Math.hypot(worldX, worldY) * Math.hypot(dx, dy))
  );
};

const singleFlight = (dx: number, dy: number, facing: number): RavenBird => ({
  facing,
  size: 66,
  perch: { x: 100, y: 300 },
  frames: [
    {
      offset: 0,
      x: 100,
      y: 300,
      rotation: 0,
      scale: 1,
      opacity: 1,
      flying: false,
    },
    {
      offset: 1,
      x: 100 + dx,
      y: 300 + dy,
      rotation: 0,
      scale: 1,
      opacity: 1,
      flying: true,
    },
  ],
});

describe('raven flight headings', () => {
  it.each([false, true])(
    'faces along the row lift, then faces the prize while tugging in RTL=%s',
    (rtl) => {
      const plan = buildRavenPlan(targets(rtl), false);
      for (const bird of plan.birds.slice(0, 2)) {
        const grab = bird.frames.find(({ offset }) => offset === RAVEN_GRAB)!;
        const lifted = bird.frames.find(({ offset }) => offset === 0.31)!;
        const firstTug = bird.frames.find(({ offset }) => offset === 0.355)!;
        expect(lifted.flying).toBe(true);
        expect(firstTug.flying).toBe(false);
        expect(
          alignment(
            headingDuring(bird, grab.offset, lifted.offset),
            lifted.x - grab.x,
            lifted.y - grab.y,
          ),
        ).toBeCloseTo(1, 5);
        const grounded = headingDuring(bird, lifted.offset, firstTug.offset);
        expect(grounded.facing).toBe(bird.facing);
        expect(grounded.rotation).toBe(0);
      }
    },
  );

  it.each([
    [8, -240, -1],
    [-8, -240, 1],
    [8, 240, -1],
    [-8, 240, 1],
    [0, -240, 1],
    [0, -240, -1],
    [0, 240, 1],
    [0, 240, -1],
    [0.001, 0, -1],
    [-0.001, 0, 1],
  ])(
    'keeps the beak ahead of both head and body for travel (%s, %s), initial facing %s',
    (dx, dy, facing) => {
      const bird = singleFlight(dx, dy, facing);
      const heading = headingDuring(bird, 0, 1);
      expect(Number.isFinite(heading.rotation)).toBe(true);
      expect(alignment(heading, dx, dy)).toBeCloseTo(1, 5);
      /* Actual SVG points: beak (114,35), eye (81,26), body (66,65). */
      expect(alignment(heading, dx, dy, 33, 9)).toBeGreaterThan(0);
      expect(alignment(heading, dx, dy, 48, -30)).toBeGreaterThan(0);
      if (dx !== 0) expect(heading.facing).toBe(Math.sign(dx));
    },
  );

  it('keeps the grounded grip pose after an airborne arrival', () => {
    const bird = singleFlight(-40, 8, 1);
    bird.frames[0].rotation = 17;
    bird.frames[0].flying = true;
    bird.frames[1].rotation = 17;
    bird.frames[1].flying = false;
    const heading = headingDuring(bird, 0, 1);
    expect(heading.facing).toBe(1);
    expect(heading.rotation).toBe(17);
  });

  it('lands at each material before bracing to peel it off', () => {
    const plan = buildRavenPlan(targets(false), false);
    const workers = plan.birds.filter(({ pickup }) => pickup !== undefined);
    expect(workers.length).toBeGreaterThan(0);
    for (const bird of workers) {
      const pickupIndex = bird.frames.findIndex(
        ({ offset }) => offset === bird.pickup,
      );
      const approach = bird.frames[pickupIndex - 1];
      const pickup = bird.frames[pickupIndex];
      const peel = bird.frames[pickupIndex + 1];
      expect(pickup.flying).toBe(true);
      expect(peel.flying).toBe(false);
      expect(
        alignment(
          headingDuring(bird, approach.offset, pickup.offset),
          pickup.x - approach.x,
          pickup.y - approach.y,
        ),
      ).toBeCloseTo(1, 5);
      expect(headingDuring(bird, pickup.offset, peel.offset).facing).toBe(
        bird.facing,
      );
    }
  });
});

import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  buildRavenPlan,
  ravenFacingFrames,
  RAVEN_GRAB,
  RAVEN_RELEASE,
  RAVEN_RESTORE,
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
const targets = (width = 1280, rtl = false): RavenTargets => {
  const composer = surface(width * 0.27, 400, width * 0.65, 150);
  const pumpkin = surface(rtl ? 20 : width - 150, 570, 128, 128);
  const conversation = surface(rtl ? width - 260 : 20, 150, 240, 40);
  return {
    width,
    height: 800,
    composer,
    pumpkin,
    conversation,
    fragments: [],
    edges: [composer, conversation],
  };
};
afterEach(() => vi.restoreAllMocks());

describe('raven story geometry', () => {
  it.each([true, false])(
    'bounds all actors and timelines on mobile=%s',
    (mobile) => {
      const plan = buildRavenPlan(targets(mobile ? 360 : 1280), mobile);
      expect(plan.birds).toHaveLength(mobile ? 5 : 8);
      expect(plan.materials.length).toBeLessThanOrEqual(mobile ? 3 : 6);
      for (const bird of plan.birds) {
        expect(bird.frames[0].offset).toBe(0);
        expect(bird.frames.at(-1)?.offset).toBe(1);
        const offsets = bird.frames.map((frame) => frame.offset);
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
        expect(
          bird.frames.every((frame) =>
            Object.values(frame).every(
              (value) => typeof value !== 'number' || Number.isFinite(value),
            ),
          ),
        ).toBe(true);
        expect(bird.frames.length).toBeLessThan(25);
      }
    },
  );

  it('grips the actual original row before tugging and returns it unchanged', () => {
    const input = targets();
    const plan = buildRavenPlan(input, false);
    const grab = plan.cargo.find((frame) => frame.offset === RAVEN_GRAB);
    const returned = plan.cargo.find((frame) => frame.offset === RAVEN_RESTORE);
    expect(grab).toMatchObject({
      x: 140,
      y: 170,
      width: 240,
      height: 40,
      rotation: 0,
      bend: 0,
      opacity: 1,
    });
    expect(returned).toEqual({ ...grab, offset: RAVEN_RESTORE });
    expect(plan.conversation).toBe(input.conversation);
    expect(
      plan.birds[0].frames.find((f) => f.offset === RAVEN_GRAB),
    ).toMatchObject({ x: 20, y: 170 });
    expect(
      plan.birds[1].frames.find((f) => f.offset === RAVEN_GRAB),
    ).toMatchObject({ x: 260, y: 170 });
  });

  it('keeps each pulling beak on its row edge during tugging and the winning flight', () => {
    const plan = buildRavenPlan(targets(), false);
    for (const [side, bird] of plan.birds.slice(0, 2).entries()) {
      for (const frame of plan.cargo.filter(
        (f) =>
          f.offset >= RAVEN_GRAB && f.offset <= (side ? 0.74 : RAVEN_RELEASE),
      )) {
        const pose = bird.frames.find((f) => f.offset === frame.offset);
        const sign = side ? 1 : -1;
        expect(pose?.x).toBeCloseTo(
          frame.x +
            ((sign * frame.width) / 2) *
              Math.cos((frame.rotation * Math.PI) / 180),
        );
        expect(pose?.y).toBeCloseTo(
          frame.y +
            ((sign * frame.width) / 2) *
              Math.sin((frame.rotation * Math.PI) / 180),
        );
      }
    }
    expect(
      plan.cargo.find((frame) => frame.offset === 0.355)?.bend,
    ).toBeLessThan(5);
    expect(
      plan.cargo.find((frame) => frame.offset === RAVEN_RELEASE)?.bend,
    ).toBeGreaterThan(15);
    expect(
      plan.birds[0].frames.find((frame) => frame.offset === 0.605)?.flying,
    ).toBe(true);
  });

  it.each([false, true])(
    'uses the actual pumpkin position in rtl=%s',
    (rtl) => {
      const input = targets(1280, rtl);
      const plan = buildRavenPlan(input, false);
      expect(plan.nest).toEqual({
        x: (rtl ? 20 : 1130) + 64,
        y: 570 + 128 * 0.3,
      });
      expect(plan.cargo.find((frame) => frame.offset === 0.74)?.x).toBe(
        plan.nest.x,
      );
    },
  );

  it('uses a composer strip without borrowing the input when history is absent', () => {
    const input = targets(360);
    input.conversation = null;
    const plan = buildRavenPlan(input, true);
    expect(plan.conversation).toBeNull();
    expect(plan.cargo[0].height).toBe(8);
    expect(plan.cargo[0].y).toBe(input.composer?.rect.top);
    expect(plan.birds).toHaveLength(5);
  });

  it('uses a composer corner for a missing pumpkin and static artwork for missing UI', () => {
    const input = targets();
    input.pumpkin = null;
    expect(buildRavenPlan(input, false).nest.y).toBe(input.composer?.rect.top);
    const plan = buildRavenPlan(
      {
        ...input,
        composer: null,
        conversation: null,
        fragments: [],
        edges: [],
      },
      false,
    );
    expect(plan.active).toBe(false);
    expect(plan.birds).toHaveLength(8);
  });

  it('gives collectors separate pieces, staggered deliveries and different departures', () => {
    const input = targets();
    input.fragments = Array.from({ length: 6 }, (_, index) => {
      const source = surface(
        350 + (index % 3) * 230,
        100 + Math.floor(index / 3) * 240,
        100,
        35,
      );
      return { ...source, crop: source.rect };
    });
    const plan = buildRavenPlan(input, false);
    const workers = plan.birds.slice(2);
    expect(new Set(workers.map(({ material }) => material)).size).toBe(6);
    expect(plan.materials.map(({ fragment }) => fragment)).toEqual(
      input.fragments,
    );
    for (let index = 0; index < workers.length; index++) {
      const bird = workers[index];
      const departure = bird.frames.at(-2)!;
      expect(departure.opacity).toBe(0);
      expect(departure.offset).toBeLessThan(0.9);
      expect(
        bird.frames.every(
          (frame) => frame.flying || frame.offset < bird.delivery!,
        ),
      ).toBe(true);
      if (index)
        expect(bird.delivery! - workers[index - 1].delivery!).toBeGreaterThan(
          0.045,
        );
    }
    expect(
      new Set(workers.map((bird) => JSON.stringify(bird.frames.at(-1)))).size,
    ).toBe(6);
  });

  it.each([false, true])(
    'faces the flight direction on arrival, delivery and departure in RTL=%s',
    (rtl) => {
      const plan = buildRavenPlan(targets(1280, rtl), false);
      for (const bird of plan.birds) {
        const turns = ravenFacingFrames(bird);
        expect(turns.map(({ offset }) => offset)).toEqual(
          turns.map(({ offset }) => offset).sort((a, b) => a - b),
        );
        for (let index = 0; index < bird.frames.length - 1; index++) {
          const from = bird.frames[index];
          const to = bird.frames[index + 1];
          const middle = (from.offset + to.offset) / 2;
          const facing = turns
            .filter(({ offset }) => offset <= middle)
            .at(-1)?.facing;
          const dx = to.x - from.x;
          if (to.flying && Math.abs(dx) > 2) {
            expect(facing).toBe(Math.sign(dx));
          } else if (!to.flying) {
            expect(facing).toBe(bird.facing);
          }
        }
      }
    },
  );

  it('varies collectors without varying their grip point at pickup', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const first = buildRavenPlan(targets(), false);
    vi.mocked(Math.random).mockReturnValue(0.8);
    const next = buildRavenPlan(targets(), false);
    expect(first.birds[2].pickup).not.toBe(next.birds[2].pickup);
    for (const plan of [first, next]) {
      const bird = plan.birds[2];
      expect(
        bird.frames.find((frame) => frame.offset === bird.pickup),
      ).toMatchObject({
        x: plan.materials[0].x,
        y: plan.materials[0].y + plan.materials[0].height / 2,
      });
    }
  });
});

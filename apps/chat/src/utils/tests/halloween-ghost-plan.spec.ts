import { describe, expect, it } from 'vitest';
import { HalloweenGhostVariant } from '../../types/halloween';
import type { CelebrationSnapshotTarget } from '../celebration-snapshots';
import {
  buildGhostPlan,
  GHOST_PUMPKIN_REACTION,
  GHOST_RESTORE,
  type GhostActor,
} from '../halloween-ghost-plan';
import type { GhostTargets } from '../halloween-ghost-targets';

const target = (
  left: number,
  top: number,
  width = 180,
  height = 40,
): CelebrationSnapshotTarget => ({
  element: document.createElement('button'),
  rect: new DOMRect(left, top, width, height),
});
const fixture = (): GhostTargets => ({
  width: 1280,
  height: 900,
  pumpkin: target(1100, 700, 120, 120),
  homes: [
    target(20, 100, 220),
    target(500, 550),
    target(400, 400, 80),
    target(530, 180, 280, 50),
    target(800, 400, 80),
    target(20, 300, 220),
  ],
});
const seeded = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
};
const translation = (frame: Keyframe) => {
  const match = String(frame.transform).match(
    /translate\(([-\d.e]+)px, ([-\d.e]+)px\)/,
  );
  if (!match) throw new Error(`Missing translation: ${frame.transform}`);
  return { x: Number(match[1]), y: Number(match[2]) };
};
const lastFrame = (frames: Keyframe[]) => frames[frames.length - 1];
const firstVisible = (frames: Keyframe[]) =>
  frames.find((frame) => Number(frame.opacity) > 0)?.offset ?? 1;
const fullyOutside = (
  frame: Keyframe,
  actor: GhostActor,
  targets: GhostTargets,
) => {
  const { x, y } = translation(frame);
  const halfHeight = (actor.size * 88) / 64 / 2;
  return (
    x + actor.size / 2 < 0 ||
    x - actor.size / 2 > targets.width ||
    y + halfHeight < 0 ||
    y - halfHeight > targets.height
  );
};

describe('ghost possession story', () => {
  it.each([
    { isMobile: true, count: 3 },
    { isMobile: false, count: 5 },
  ])('bounds actors and homes to $count', ({ isMobile, count }) => {
    const targets = fixture();
    const plan = buildGhostPlan(targets, isMobile, seeded(7));
    expect(plan.active).toBe(true);
    expect(plan.actors).toHaveLength(count);
    expect(plan.homes).toHaveLength(count);
    expect(plan.actors.filter(({ leader }) => leader)).toHaveLength(1);
    expect(new Set(plan.actors.map(({ home }) => home)).size).toBe(count);
    expect(plan.actors.map(({ variant }) => variant)).toEqual(
      expect.arrayContaining(
        Object.values(HalloweenGhostVariant).slice(0, Math.min(count, 4)),
      ),
    );
    for (const actor of plan.actors) {
      expect(actor.size).toBeLessThanOrEqual(isMobile ? 69 : 81);
      expect(actor.size).toBeGreaterThanOrEqual(isMobile ? 53 : 65);
      expect(plan.homes[actor.home].target).toBe(targets.homes[actor.home]);
    }
    expect(targets.homes).toHaveLength(6);
  });

  it('possesses homes before the scare and gives the frightened leader a later hiding place', () => {
    const plan = buildGhostPlan(fixture(), false, seeded(1));
    const leader = plan.actors.find((actor) => actor.leader)!;
    const followers = plan.actors.filter((actor) => !actor.leader);
    for (const actor of followers) {
      const home = plan.homes[actor.home];
      expect(home.entry).toBeLessThan(GHOST_PUMPKIN_REACTION);
      expect(firstVisible(home.eyesFrames)).toBeGreaterThan(home.entry);
      expect(firstVisible(home.eyesFrames)).toBeLessThan(
        GHOST_PUMPKIN_REACTION,
      );
      expect(
        actor.frames.some(
          (frame) =>
            Number(frame.offset) > home.entry &&
            Number(frame.offset) < GHOST_PUMPKIN_REACTION &&
            frame.opacity === 0,
        ),
      ).toBe(true);
    }
    expect(firstVisible(leader.frightFrames)).toBeGreaterThan(
      GHOST_PUMPKIN_REACTION,
    );
    expect(plan.homes[leader.home].entry).toBeGreaterThan(
      firstVisible(leader.frightFrames),
    );
    expect(
      leader.clothFrames.some(
        (frame) =>
          Number(frame.offset) > plan.homes[leader.home].entry &&
          frame.clipPath === 'inset(100% 0% 0% 0%)',
      ),
    ).toBe(true);
  });

  it.each([true, false])(
    'keeps all story timelines finite and ordered (mobile=%s)',
    (isMobile) => {
      for (let seed = 0; seed < 12; seed++) {
        const plan = buildGhostPlan(fixture(), isMobile, seeded(seed));
        const timelines = [
          ...plan.homes.flatMap((home) => [
            home.frames,
            home.eyesFrames,
            home.lookFrames,
          ]),
          ...plan.actors.flatMap((actor) => [
            actor.frames,
            actor.clothFrames,
            actor.frightFrames,
          ]),
        ];
        for (const frames of timelines) {
          const offsets = frames.map((frame) => Number(frame.offset));
          expect(offsets[0]).toBe(0);
          expect(offsets[offsets.length - 1]).toBe(1);
          expect(offsets).toEqual(
            [...offsets].sort((first, second) => first - second),
          );
          expect(
            offsets.every(
              (offset) => Number.isFinite(offset) && offset >= 0 && offset <= 1,
            ),
          ).toBe(true);
          expect(JSON.stringify(frames)).not.toMatch(/NaN|Infinity|undefined/);
        }
      }
    },
  );

  it.each([true, false])(
    'sends ghosts out through separated screen edges (mobile=%s)',
    (isMobile) => {
      const targets = fixture();
      const plan = buildGhostPlan(targets, isMobile, seeded(82));
      const edges = new Set<string>();
      const exits = new Set<string>();
      const departureTimes = new Set<number>();
      for (const actor of plan.actors) {
        expect(fullyOutside(actor.frames[0], actor, targets)).toBe(true);
        const last = lastFrame(actor.frames);
        expect(fullyOutside(last, actor, targets)).toBe(true);
        expect(last.opacity).toBe(0);
        const point = translation(last);
        if (point.x < 0) edges.add('left');
        if (point.x > targets.width) edges.add('right');
        if (point.y < 0) edges.add('top');
        if (point.y > targets.height) edges.add('bottom');
        exits.add(`${point.x},${point.y}`);
        departureTimes.add(
          Number(actor.frames[actor.frames.length - 4].offset),
        );
      }
      expect(edges.size).toBeGreaterThanOrEqual(isMobile ? 3 : 4);
      expect(exits.size).toBe(plan.actors.length);
      expect(departureTimes.size).toBe(plan.actors.length);
    },
  );

  it('uses exact whole-element homes and aims their eyes toward the reacting pumpkin', () => {
    const targets = fixture();
    const plan = buildGhostPlan(targets, false, seeded(2));
    const pumpkin = targets.pumpkin!.rect;
    const pumpkinCenter = {
      x: pumpkin.left + pumpkin.width / 2,
      y: pumpkin.top + pumpkin.height / 2,
    };
    for (const [index, home] of plan.homes.entries()) {
      const rect = targets.homes[index].rect;
      expect(home.target.rect).toBe(rect);
      expect(home.center).toEqual({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      const idle = home.frames.find((frame) => frame.offset === home.entry)!;
      expect(translation(idle)).toEqual({ x: 0, y: 0 });
      const look = translation(lastFrame(home.lookFrames));
      expect(Math.sign(look.x)).toBe(
        Math.sign(pumpkinCenter.x - home.center.x),
      );
      expect(Math.sign(look.y)).toBe(
        Math.sign(pumpkinCenter.y - home.center.y),
      );
      expect(Math.abs(look.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(look.y)).toBeLessThanOrEqual(2);
      expect(
        home.lookFrames.some(
          (frame) => Number(frame.offset) > GHOST_PUMPKIN_REACTION,
        ),
      ).toBe(true);
    }
  });

  it('returns every possessed home to its exact original pose before revealing the real UI', () => {
    const plan = buildGhostPlan(fixture(), false, seeded(6));
    for (const home of plan.homes) {
      const restored = home.frames.find(
        (frame) => frame.offset === GHOST_RESTORE,
      )!;
      expect(restored.transform).toBe('translate(0px, 0px) rotate(0deg)');
      expect(restored.opacity).toBe(1);
      expect(lastFrame(home.frames).opacity).toBe(0);
      expect(lastFrame(home.eyesFrames).opacity).toBe(0);
    }
  });

  it.each(['pumpkin', 'homes', 'both'])(
    'has a harmless fallback without %s',
    (missing) => {
      const targets = fixture();
      if (missing !== 'homes') targets.pumpkin = undefined;
      if (missing !== 'pumpkin') targets.homes = [];
      let plan: ReturnType<typeof buildGhostPlan> | undefined;
      expect(() => {
        plan = buildGhostPlan(targets, false, seeded(3));
      }).not.toThrow();
      expect(plan?.active).toBe(false);
    },
  );

  it('repeats a seeded activation exactly and produces fresh routes for another activation', () => {
    const targets = fixture();
    const first = buildGhostPlan(targets, false, seeded(56));
    expect(buildGhostPlan(targets, false, seeded(56))).toEqual(first);
    expect(
      buildGhostPlan(targets, false, seeded(57)).actors.map(
        ({ frames }) => frames,
      ),
    ).not.toEqual(first.actors.map(({ frames }) => frames));
  });

  it.each([false, true])(
    'stages the scare within a narrow viewport with physical RTL placement=%s',
    (isRtl) => {
      const width = 360;
      const mirror = ({
        rect,
        element,
      }: CelebrationSnapshotTarget): CelebrationSnapshotTarget => ({
        element,
        rect: new DOMRect(
          width - rect.right,
          rect.top,
          rect.width,
          rect.height,
        ),
      });
      const base = [
        target(8, 80, 150, 32),
        target(200, 300, 140),
        target(60, 480, 240, 45),
      ];
      const pumpkin = target(270, 650, 80, 80);
      const targets: GhostTargets = {
        width,
        height: 780,
        pumpkin: isRtl ? mirror(pumpkin) : pumpkin,
        homes: isRtl ? base.map(mirror) : base,
      };
      const plan = buildGhostPlan(targets, true, seeded(8));
      const leader = plan.actors.find((actor) => actor.leader)!;
      const scare = translation(
        leader.frames.find((frame) => frame.offset === GHOST_PUMPKIN_REACTION)!,
      );
      const pumpkinRect = targets.pumpkin!.rect;
      if (isRtl) expect(scare.x).toBeGreaterThan(pumpkinRect.right);
      else expect(scare.x).toBeLessThan(pumpkinRect.left);
      expect(scare.x - leader.size / 2).toBeGreaterThanOrEqual(0);
      expect(scare.x + leader.size / 2).toBeLessThanOrEqual(width);
      expect(scare.y - (leader.size * 88) / 64 / 2).toBeGreaterThanOrEqual(0);
      expect(scare.y + (leader.size * 88) / 64 / 2).toBeLessThanOrEqual(
        targets.height,
      );
      for (const actor of plan.actors) {
        expect(actor.rest.x - actor.size / 2).toBeGreaterThanOrEqual(0);
        expect(actor.rest.x + actor.size / 2).toBeLessThanOrEqual(width);
      }
    },
  );
});

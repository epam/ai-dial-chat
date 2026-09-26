import { describe, expect, it } from 'vitest';
import {
  HALLOWEEN_BURST_DURATION_MS,
  HALLOWEEN_SCENE_DURATIONS,
} from '../../constants/halloween';
import { HalloweenBurst } from '../../types/halloween';
import type { CelebrationSnapshotTarget } from '../celebration-snapshots';
import {
  BAT_RESTORE,
  BAT_SCENE_MS,
  BatPart,
  buildBatPlan,
  type BatActor,
} from '../halloween-bat-plan';
import type { BatTargets } from '../halloween-bat-targets';

const target = (
  left: number,
  top: number,
  width = 180,
  height = 40,
): CelebrationSnapshotTarget => ({
  element: document.createElement('button'),
  rect: new DOMRect(left, top, width, height),
});
const fixture = (mobile = false): BatTargets =>
  mobile
    ? {
        width: 360,
        height: 780,
        composer: target(20, 250, 320, 160),
        perch: target(205, 370, 70, 32),
        surfaces: [
          target(20, 510, 140),
          target(200, 510, 140),
          target(70, 160, 220, 35),
          target(40, 600, 280),
        ],
      }
    : {
        width: 1280,
        height: 900,
        composer: target(350, 300, 600, 180),
        perch: target(680, 430, 80, 32),
        surfaces: [
          target(470, 580, 200, 60),
          target(760, 580, 200, 60),
          target(480, 180, 300, 45),
          target(20, 460, 240),
          target(1010, 460, 240),
          target(450, 730, 220),
        ],
      };
const seeded = (seed: number) => {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
};
const transform = (frame: Keyframe) => {
  const translation = String(frame.transform).match(
    /translate\(([-\d.e]+)px, ([-\d.e]+)px\)/,
  );
  const rotation = String(frame.transform).match(/rotate\(([-\d.e]+)deg\)/);
  if (!translation || !rotation)
    throw new Error(`Missing actor pose: ${frame.transform}`);
  return {
    x: Number(translation[1]),
    y: Number(translation[2]),
    rotation: Number(rotation[1]),
  };
};
const poseAt = (actor: BatActor, time: number) => {
  const end = actor.frames.findIndex((frame) => Number(frame.offset) >= time);
  const from = actor.frames[Math.max(0, end - 1)];
  const to = actor.frames[end];
  const duration = Number(to.offset) - Number(from.offset);
  const fraction = duration ? (time - Number(from.offset)) / duration : 1;
  const a = transform(from);
  const b = transform(to);
  return {
    x: a.x + (b.x - a.x) * fraction,
    y: a.y + (b.y - a.y) * fraction,
    rotation: a.rotation + (b.rotation - a.rotation) * fraction,
  };
};
const worldPoint = (
  actor: BatActor,
  time: number,
  svgX: number,
  svgY: number,
) => {
  const pose = poseAt(actor, time);
  const angle = (pose.rotation * Math.PI) / 180;
  /* The 100×80 artwork is positioned around its claws at SVG (50,66). */
  const x = ((svgX - 50) * actor.size) / 100;
  const y = ((svgY - 66) * actor.size) / 100;
  return {
    x: pose.x + x * Math.cos(angle) - y * Math.sin(angle),
    y: pose.y + x * Math.sin(angle) + y * Math.cos(angle),
  };
};
const amplitude = (frames: Keyframe[]) =>
  Math.max(
    ...frames.map((frame) =>
      Math.abs(
        Number(
          String(frame.transform).match(/rotate\(([-\d.e]+)deg\)/)?.[1] ?? 0,
        ),
      ),
    ),
  );

describe('bat wind story geometry', () => {
  it('gives the slower bat story time to finish without extending other celebrations', () => {
    const deadline = HALLOWEEN_SCENE_DURATIONS[HalloweenBurst.Bats]!;
    expect(BAT_SCENE_MS).toBeGreaterThan(HALLOWEEN_BURST_DURATION_MS);
    expect(deadline).toBeGreaterThan(BAT_SCENE_MS);
    for (const [scene, duration] of Object.entries(HALLOWEEN_SCENE_DURATIONS)) {
      /* The cat story carries its own longer lifetime, like the bats. */
      if (scene !== HalloweenBurst.Bats && scene !== HalloweenBurst.Cat)
        expect(duration).toBeLessThanOrEqual(HALLOWEEN_BURST_DURATION_MS);
    }
  });

  it('accelerates into the approach and decelerates before each helper settles into its hover', () => {
    const helpers = buildBatPlan(fixture(), false, seeded(8)).actors.filter(
      ({ sleeper }) => !sleeper,
    );
    for (const helper of helpers) {
      const startingPoint = transform(helper.frames[0]);
      const firstMoving = helper.frames.findIndex((frame) => {
        const point = transform(frame);
        return (
          Math.hypot(point.x - startingPoint.x, point.y - startingPoint.y) >
          0.01
        );
      });
      const departure = Number(helper.frames[firstMoving - 1].offset);
      const arrival = Number(
        helper.frames.find((frame) => {
          const point = transform(frame);
          return (
            Math.hypot(point.x - helper.rest.x, point.y - helper.rest.y) < 0.01
          );
        })!.offset,
      );
      const span = arrival - departure;
      const speed = (from: number, to: number) => {
        const a = poseAt(helper, departure + span * from);
        const b = poseAt(helper, departure + span * to);
        return Math.hypot(b.x - a.x, b.y - a.y) / ((to - from) * span);
      };
      const cruisingSpeed = speed(0.45, 0.55);
      expect(cruisingSpeed).toBeGreaterThan(0);
      expect(speed(0, 0.1)).toBeLessThan(cruisingSpeed * 0.35);
      expect(speed(0.9, 1)).toBeLessThan(cruisingSpeed * 0.35);
      const hovering = poseAt(helper, arrival + 0.02);
      expect(hovering.x).toBeCloseTo(helper.rest.x);
      expect(Math.abs(hovering.y - helper.rest.y)).toBeLessThanOrEqual(2.5);
    }
  });

  it('carries momentum through the vortex instead of stopping and easing again at every waypoint', () => {
    const helpers = buildBatPlan(fixture(), false, seeded(8)).actors.filter(
      ({ sleeper }) => !sleeper,
    );
    for (const helper of helpers) {
      const orbit = helper.frames.filter(
        ({ offset }) => Number(offset) > 0.66 && Number(offset) < 0.73,
      );
      expect(orbit.length).toBeGreaterThan(8);
      const speeds: number[] = [];
      for (const frame of orbit) {
        expect(frame.easing).toBe('linear');
        const t = Number(frame.offset);
        const before = poseAt(helper, t - 0.0002);
        const at = poseAt(helper, t);
        const after = poseAt(helper, t + 0.0002);
        const incoming = { x: at.x - before.x, y: at.y - before.y };
        const outgoing = { x: after.x - at.x, y: after.y - at.y };
        expect(
          incoming.x * outgoing.x + incoming.y * outgoing.y,
        ).toBeGreaterThan(0);
        speeds.push(
          Math.hypot(incoming.x, incoming.y),
          Math.hypot(outgoing.x, outgoing.y),
        );
      }
      const averageSpeed =
        speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length;
      expect(Math.min(...speeds)).toBeGreaterThan(averageSpeed * 0.2);
    }
  });

  it('folds the outer wing during recovery and extends it for the power stroke', () => {
    const helpers = buildBatPlan(fixture(), false, seeded(8)).actors.filter(
      ({ sleeper }) => !sleeper,
    );
    for (const helper of helpers) {
      for (const part of [BatPart.ForearmLeft, BatPart.ForearmRight]) {
        const frames = helper.parts[part];
        const scales = frames.map((frame) =>
          Number(String(frame.transform).match(/scaleX\(([-\d.e]+)\)/)?.[1]),
        );
        expect(scales.every(Number.isFinite)).toBe(true);
        const folded = frames.filter((_, index) => scales[index] < 0.85);
        expect(folded.length).toBeGreaterThan(15);
        for (let index = 1; index < frames.length - 1; index++) {
          if (scales[index] >= 0.85 || frames[index + 1].offset === 1) continue;
          expect(scales[index - 1]).toBeGreaterThanOrEqual(0.98);
          expect(scales[index + 1]).toBeGreaterThan(scales[index] + 0.1);
        }
      }
    }
  });

  it('keeps full wing cycles continuous while increasing the stroke amplitude for the stronger attempt', () => {
    const helpers = buildBatPlan(fixture(), false, seeded(8)).actors.filter(
      ({ sleeper }) => !sleeper,
    );
    for (const helper of helpers) {
      const folds = helper.parts[BatPart.ForearmLeft].filter(
        ({ transform, offset }) =>
          Number(offset) < 1 &&
          Number(String(transform).match(/scaleX\(([-\d.e]+)\)/)?.[1]) < 0.85,
      );
      const wings = helper.parts[BatPart.WingLeft].filter(
        ({ offset }) => Number(offset) < 1,
      );
      let previousDuration: number | undefined;
      for (let index = 1; index < folds.length; index++) {
        const duration =
          (Number(folds[index].offset) - Number(folds[index - 1].offset)) *
          BAT_SCENE_MS;
        expect(duration).toBeGreaterThan(250);
        expect(duration).toBeLessThan(1200);
        if (previousDuration !== undefined) {
          expect(duration / previousDuration).toBeGreaterThan(0.6);
          expect(duration / previousDuration).toBeLessThan(1.6);
        }
        previousDuration = duration;
      }
      const gentle = wings.filter(
        ({ offset }) => Number(offset) > 0.28 && Number(offset) < 0.39,
      );
      const strong = wings.filter(
        ({ offset }) => Number(offset) > 0.52 && Number(offset) < 0.6,
      );
      expect(amplitude(strong)).toBeGreaterThan(amplitude(gentle) * 1.4);
    }
  });

  it.each([true, false])(
    'bounds actors and borrowed surfaces on mobile=%s',
    (mobile) => {
      const plan = buildBatPlan(fixture(mobile), mobile, seeded(1));
      expect(plan.active).toBe(true);
      expect(plan.actors).toHaveLength(3);
      expect(plan.actors.filter(({ sleeper }) => sleeper)).toHaveLength(1);
      expect(plan.surfaces).toHaveLength(mobile ? 3 : 5);
      expect(plan.actors.every(({ size }) => size <= (mobile ? 80 : 102))).toBe(
        true,
      );
    },
  );

  it('keeps the sleeping claws attached to the actual composer edge while the body wraps and sways', () => {
    const input = fixture();
    const sleeper = buildBatPlan(input, false, seeded(3)).actors.find(
      ({ sleeper }) => sleeper,
    )!;
    const edge = input.composer!.rect;
    for (const time of [0.16, 0.26, 0.39, 0.425, 0.46, 0.7, 0.8]) {
      const grip = worldPoint(sleeper, time, 50, 66);
      expect(grip.x).toBeGreaterThan(edge.left);
      expect(grip.x).toBeLessThan(edge.right);
      expect(grip.x).toBeCloseTo(sleeper.rest.x);
      expect(grip.y).toBeCloseTo(edge.bottom);
      expect(worldPoint(sleeper, time, 50, 30).y).toBeGreaterThan(edge.bottom);
    }
    expect(
      sleeper.parts[BatPart.Wrap].some(({ opacity }) => opacity === 1),
    ).toBe(true);
  });

  it('sweeps the two helpers through separate exits before the sleeper lets go', () => {
    const input = fixture();
    const plan = buildBatPlan(input, false, seeded(6));
    const sleeper = plan.actors.find(({ sleeper }) => sleeper)!;
    const helpers = plan.actors.filter(({ sleeper }) => !sleeper);
    const exits = helpers.map((helper) => {
      let lastVisible = 0;
      helper.frames.forEach(({ opacity }, index) => {
        if (Number(opacity) > 0) lastVisible = index;
      });
      const gone = helper.frames[lastVisible + 1];
      expect(Number(gone.offset)).toBeLessThan(0.85);
      expect(gone.opacity).toBe(0);
      const point = transform(gone);
      expect(point.x < 0 || point.x > input.width).toBe(true);
      return point;
    });
    expect(exits[0].x).toBeLessThan(0);
    expect(exits[1].x).toBeGreaterThan(input.width);
    expect(worldPoint(sleeper, 0.85, 50, 66).y).toBeCloseTo(
      input.composer!.rect.bottom,
    );
    expect(sleeper.frames.at(-1)?.opacity).toBe(0);
    expect(transform(sleeper.frames.at(-1)!).x).toBeGreaterThan(input.width);
  });

  it.each([true, false])(
    'keeps every actor, articulated body part and surface timeline finite and ordered on mobile=%s',
    (mobile) => {
      for (let seed = 0; seed < 8; seed++) {
        const plan = buildBatPlan(fixture(mobile), mobile, seeded(seed));
        const timelines = [
          ...plan.actors.flatMap((actor) => [
            actor.frames,
            ...Object.values(actor.parts),
          ]),
          ...plan.surfaces.map(({ frames }) => frames),
        ];
        for (const frames of timelines) {
          const offsets = frames.map(({ offset }) => Number(offset));
          expect(offsets[0]).toBe(0);
          expect(offsets.at(-1)).toBe(1);
          expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
          expect(
            offsets.every(
              (offset) => Number.isFinite(offset) && offset >= 0 && offset <= 1,
            ),
          ).toBe(true);
          expect(JSON.stringify(frames)).not.toMatch(/NaN|Infinity|undefined/);
          expect(frames.length).toBeLessThanOrEqual(220);
        }
      }
    },
  );

  it('builds an activation deterministically without mutating targets, while a different seed varies the resting place', () => {
    const input = fixture();
    const original = input.surfaces.slice();
    const first = buildBatPlan(input, false, seeded(10));
    expect(buildBatPlan(input, false, seeded(10))).toEqual(first);
    expect(buildBatPlan(input, false, seeded(11)).actors[0].rest).not.toEqual(
      first.actors[0].rest,
    );
    expect(input.surfaces).toEqual(original);
    expect(first.composer).toBe(input.composer);
  });

  it.each(['composer', 'width', 'clearance'])(
    'uses a harmless empty plan when %s is insufficient',
    (reason) => {
      const input = fixture();
      if (reason === 'composer') input.composer = undefined;
      if (reason === 'width') input.width = 280;
      if (reason === 'clearance')
        input.height = input.composer!.rect.bottom + 60;
      const plan = buildBatPlan(input, false, seeded(2));
      expect(plan.active).toBe(false);
      expect(plan.actors).toEqual([]);
      expect(plan.surfaces).toEqual([]);
    },
  );

  it('stages the mobile actors within the viewport while hanging and fanning', () => {
    const input = fixture(true);
    const plan = buildBatPlan(input, true, seeded(4));
    for (const actor of plan.actors) {
      for (const time of [0.265, 0.352, 0.472, 0.555]) {
        for (const [x, y] of [
          [0, 0],
          [100, 0],
          [0, 80],
          [100, 80],
        ]) {
          const point = worldPoint(actor, time, x, y);
          expect(point.x).toBeGreaterThanOrEqual(0);
          expect(point.x).toBeLessThanOrEqual(input.width);
          expect(point.y).toBeGreaterThanOrEqual(0);
          expect(point.y).toBeLessThanOrEqual(input.height);
        }
      }
    }
  });

  it('keeps borrowed elements still until the air from a helper wingstroke reaches them', () => {
    const plan = buildBatPlan(fixture(), false, seeded(8));
    for (const surface of plan.surfaces) {
      expect(surface.impacts).toHaveLength(4);
      expect(surface.entry).toBe(surface.impacts[0].time);
      for (const impact of surface.impacts) {
        expect(impact.time).toBeGreaterThan(impact.launch);
        const arrival = surface.frames.find(
          ({ offset }) => offset === impact.time,
        )!;
        expect(arrival.transform).toBe('rotate(0deg) translateY(0px)');
      }
      expect(
        surface.frames
          .filter(({ offset }) => Number(offset) <= surface.entry)
          .every(
            ({ transform }) => transform === 'rotate(0deg) translateY(0px)',
          ),
      ).toBe(true);
    }
  });

  it('produces visibly stronger rocking on the second attempt and settles exactly before restoration', () => {
    const plan = buildBatPlan(fixture(), false, seeded(8));
    for (const surface of plan.surfaces) {
      const gentle = surface.frames.filter(
        ({ offset }) =>
          Number(offset) >= surface.impacts[0].time &&
          Number(offset) < surface.impacts[1].time,
      );
      const strong = surface.frames.filter(
        ({ offset }) =>
          Number(offset) >= surface.impacts[2].time &&
          Number(offset) < surface.impacts[3].time,
      );
      expect(amplitude(strong)).toBeGreaterThan(amplitude(gentle) * 2);
      expect(
        surface.frames.find(({ offset }) => offset === BAT_RESTORE),
      ).toMatchObject({
        opacity: 1,
        transform: 'rotate(0deg) translateY(0px)',
      });
      expect(surface.frames.at(-1)?.opacity).toBe(0);
    }
  });

  it('ties each delayed surface response to an actual helper power stroke with its outer wings extended', () => {
    const plan = buildBatPlan(fixture(), false, seeded(8));
    for (const surface of plan.surfaces) {
      for (const impact of surface.impacts) {
        const helper = plan.actors[impact.helper];
        expect(helper.sleeper).toBe(false);
        for (const [wing, hand] of [
          [BatPart.WingLeft, BatPart.ForearmLeft],
          [BatPart.WingRight, BatPart.ForearmRight],
        ]) {
          const wingFrames = helper.parts[wing];
          const stroke = wingFrames.findIndex(
            ({ offset }) => offset === impact.launch,
          );
          expect(stroke).toBeGreaterThan(0);
          expect(stroke).toBeLessThan(wingFrames.length - 1);
          const handFrame = helper.parts[hand].find(
            ({ offset }) => offset === impact.launch,
          );
          expect(handFrame).toBeDefined();
          expect(
            Number(
              String(handFrame!.transform).match(/scaleX\(([-\d.e]+)\)/)?.[1],
            ),
          ).toBeGreaterThanOrEqual(0.98);
          const angle = (index: number) =>
            Number(
              String(wingFrames[index].transform).match(
                /rotate\(([-\d.e]+)deg\)/,
              )?.[1],
            );
          expect(Math.sign(angle(stroke) - angle(stroke - 1))).toBe(
            -Math.sign(angle(stroke + 1) - angle(stroke)),
          );
        }
      }
    }
  });

  it('lets the same wingstroke reach nearby surfaces before distant ones', () => {
    const input = fixture();
    input.surfaces = [target(490, 580, 80, 40), target(200, 700, 80, 40)];
    const plan = buildBatPlan(input, false, seeded(8));
    expect(plan.surfaces).toHaveLength(2);
    const [near, far] = plan.surfaces.map(({ impacts }) => impacts);
    for (let index = 0; index < near.length; index++) {
      expect(near[index].helper).toBe(far[index].helper);
      expect(near[index].launch).toBe(far[index].launch);
      expect(near[index].time).toBeLessThan(far[index].time);
    }
  });

  it('does not borrow surfaces that the gusts cannot reach', () => {
    const input = fixture();
    const far = target(10, 10, 30, 30);
    input.surfaces = [far];
    const plan = buildBatPlan(input, false, seeded(8));
    expect(plan.active).toBe(true);
    expect(plan.surfaces).toEqual([]);
  });

  it.each([true, false])(
    'finishes the crawl on a usable perch or on the composer edge (usable=%s)',
    (usable) => {
      const input = fixture();
      if (!usable) input.perch = target(10, 10, 40, 30);
      const plan = buildBatPlan(input, false, seeded(8));
      const sleeper = plan.actors.find(({ sleeper }) => sleeper)!;
      const finalGrip = worldPoint(sleeper, 0.925, 50, 66);
      if (usable) {
        expect(plan.perch).toBe(input.perch);
        expect(finalGrip.x).toBeCloseTo(
          input.perch!.rect.left + input.perch!.rect.width / 2,
        );
        expect(finalGrip.y).toBeCloseTo(input.perch!.rect.bottom);
      } else {
        expect(plan.perch).toBeUndefined();
        expect(finalGrip.y).toBeCloseTo(input.composer!.rect.bottom);
        expect(finalGrip.x).toBeGreaterThan(input.composer!.rect.left);
        expect(finalGrip.x).toBeLessThan(input.composer!.rect.right);
      }
      expect(finalGrip.x).not.toBe(sleeper.rest.x);
    },
  );
});

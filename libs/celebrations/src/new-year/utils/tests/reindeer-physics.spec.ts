import { describe, expect, it } from 'vitest';
import {
  buildDeerMotion,
  flightPoint,
  posePoint,
  REINDEER_HIPS,
  rotatePoint,
  solveLeg,
  walkingHoof,
  type FlightKnot,
} from '../reindeer-physics';
import { Track } from '../snowman-delivery-timeline';

describe('reindeer support and momentum', () => {
  it.each([1, -1])(
    'plants the same hoof throughout stance, facing=%s',
    (facing) => {
      const footprints = [3, 10, 25, 39].map((distance) =>
        walkingHoof(distance, 120, facing, 0.68, 22, 0),
      );
      expect(footprints.every(({ planted }) => planted)).toBe(true);
      expect(new Set(footprints.map(({ point }) => point[0])).size).toBe(1);
      expect(footprints.every(({ point }) => point[1] === 0)).toBe(true);
      const swing = walkingHoof(54, 120, facing, 0.68, 22, 0);
      expect(swing.planted).toBe(false);
      expect(swing.point[1]).toBeLessThan(-6);
      const landed = walkingHoof(68, 120, facing, 0.68, 22, 0);
      expect(landed.point[0] - footprints[0].point[0]).toBeCloseTo(
        facing * 68 * 0.68,
      );
    },
  );

  it.each([1, -1])(
    'reconstructs fixed contacts through body lean, facing=%s',
    (facing) => {
      for (const lean of [-12, 0, 14]) {
        const pose = {
          position: [40, -52 + Math.abs(lean) * 0.8] as [number, number],
          facing,
          size: 1,
          lean,
        };
        for (const hip of REINDEER_HIPS) {
          const target: [number, number] = [40 + facing * hip[0], 0];
          const joint = solveLeg(pose, hip, target);
          const thigh = rotatePoint([0, 28], joint.upper);
          const shin = rotatePoint([0, 28], joint.upper + joint.knee);
          const actual = posePoint(pose, [
            hip[0] + thigh[0] + shin[0],
            hip[1] + thigh[1] + shin[1],
          ]);
          expect(joint.reach).toBeLessThan(56);
          expect(actual[0]).toBeCloseTo(target[0], 5);
          expect(actual[1]).toBeCloseTo(target[1], 5);
          expect(
            lean + facing * (joint.upper + joint.knee + joint.hoof),
          ).toBeCloseTo(0, 5);
        }
      }
    },
  );

  it('keeps planted contacts reachable while pulling and compressing', () => {
    const root = new Track([0, 0])
      .set(3.6, [110, 0])
      .hold(4.6)
      .set(6.1, [115, 0])
      .set(7.1, [111, 0])
      .set(10.1, [124, 0]);
    const lean = new Track([0])
      .hold(4.2)
      .set(4.6, 8)
      .set(6.1, -5)
      .set(7.1, 0)
      .set(8.6, 12)
      .set(10.1, -9);
    const motion = buildDeerMotion(
      root,
      lean,
      new Track([1]),
      1,
      [{ start: 0, end: 3.6, facing: 1 }],
      16.2,
    );
    for (let t = 4.2; t <= 10.1; t += 0.05) {
      for (let index = 0; index < 4; index++) {
        expect(motion.hoofAt(t, index).point).toEqual([
          110 + REINDEER_HIPS[index][0],
          0,
        ]);
        expect(motion.legAt(t, index).reach).toBeLessThan(56);
      }
    }
  });

  it('carries velocity through flight joins without a pause or a teleport', () => {
    const knots: FlightKnot[] = [
      { time: 0, point: [0, 0], velocity: [0, 0] },
      { time: 1, point: [20, -60], velocity: [30, -80] },
      { time: 3, point: [100, -180], velocity: [70, -15] },
      { time: 5, point: [300, -210], velocity: [100, -25] },
    ];
    const dt = 0.0001;
    for (const knot of knots.slice(1, -1)) {
      const before = flightPoint(knots, knot.time - dt);
      const at = flightPoint(knots, knot.time);
      const after = flightPoint(knots, knot.time + dt);
      for (let axis = 0; axis < 2; axis++) {
        expect((at[axis] - before[axis]) / dt).toBeCloseTo(
          knot.velocity[axis],
          1,
        );
        expect((after[axis] - at[axis]) / dt).toBeCloseTo(
          knot.velocity[axis],
          1,
        );
      }
    }
    expect(flightPoint(knots, dt)[1]).toBeGreaterThan(-0.001);
  });

  it('folds after launch and holds a relaxed flight pose instead of pedalling', () => {
    const motion = buildDeerMotion(
      new Track([0, 0]),
      new Track([0]),
      new Track([1]),
      1,
      [{ start: 0, end: 3.6, facing: 1 }],
      16.2,
    );
    for (let index = 0; index < 4; index++) {
      const tucked = motion.legAt(16.9, index);
      const settled = motion.legAt(19, index);
      expect(Math.abs(tucked.knee)).toBeGreaterThan(Math.abs(settled.knee));
      expect(motion.legAt(20, index)).toEqual(settled);
      expect(Math.sign(settled.knee)).toBe(
        REINDEER_HIPS[index][0] < 0 ? -1 : 1,
      );
    }
  });
});

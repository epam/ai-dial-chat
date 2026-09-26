import { describe, expect, it } from 'vitest';
import { HalloweenSpiderMood } from '../../types/halloween';
import {
  buildHalloweenSpiderWrapPlan,
  HALLOWEEN_PUMPKIN_SILK,
} from '../halloween-spider-wrap';

const pivot = { x: 1200, y: 80 };
const spiderHeight = 44;
const pumpkin = { left: 1100, top: 700, width: 120, height: 120 };
const plan = buildHalloweenSpiderWrapPlan({ pivot, spiderHeight, pumpkin });

/** Where the spider's body is for a pose, inverting the dangle transform. */
const bodyAt = (ms: number) => {
  const { depth, angle } = plan.poseAt(ms);
  const radians = (angle * Math.PI) / 180;
  return {
    x: pivot.x - depth * Math.sin(radians),
    y: pivot.y + depth * Math.cos(radians) + spiderHeight * 0.28,
  };
};

const toScreen = ({ x, y }: { x: number; y: number }) => ({
  x: pumpkin.left + (x * pumpkin.width) / HALLOWEEN_PUMPKIN_SILK.viewBox,
  y: pumpkin.top + (y * pumpkin.height) / HALLOWEEN_PUMPKIN_SILK.viewBox,
});

describe('buildHalloweenSpiderWrapPlan', () => {
  it('starts and ends with the spider resting on its perch', () => {
    expect(plan.poseAt(0)).toEqual({ depth: 0, angle: 0 });
    expect(plan.poseAt(plan.durationMs)).toEqual({ depth: 0, angle: 0 });
  });

  it('walks the spider along every strand it spins', () => {
    const strandMs = plan.strands.map((frames) => {
      const [, spinFrom, spinTo] = frames.map(
        ({ offset }) => Number(offset) * plan.durationMs,
      );
      return { spinFrom, spinTo };
    });
    HALLOWEEN_PUMPKIN_SILK.strands.forEach((strand, index) => {
      const { spinFrom, spinTo } = strandMs[index];
      const start = toScreen(strand.from);
      const end = toScreen(strand.to);
      expect(bodyAt(spinFrom).x).toBeCloseTo(start.x, 0);
      expect(bodyAt(spinFrom).y).toBeCloseTo(start.y, 0);
      expect(bodyAt(spinTo).x).toBeCloseTo(end.x, 0);
      expect(bodyAt(spinTo).y).toBeCloseTo(end.y, 0);
    });
  });

  it('spins strands one after another and thickens the cocoon as it goes', () => {
    const windows = plan.strands.map((frames) => [
      Number(frames[1].offset),
      Number(frames[2].offset),
    ]);
    windows
      .slice(1)
      .forEach(([from], index) =>
        expect(from).toBeGreaterThanOrEqual(windows[index][1]),
      );
    expect(plan.cocoon.at(-1)?.opacity).toBeGreaterThan(0);
  });

  it('shakes the pumpkin after the wrap and fades the silk as the spider flees', () => {
    const lastSpun = Number(plan.strands.at(-1)?.[2].offset);
    const shaking = plan.pumpkin.filter(({ transform }) =>
      String(transform).includes('rotate'),
    );
    expect(shaking.length).toBeGreaterThan(0);
    shaking.forEach(({ offset }) =>
      expect(Number(offset)).toBeGreaterThan(lastSpun),
    );
    expect(plan.silk.at(-1)?.opacity).toBe(0);
    expect(plan.moods.map(([, mood]) => mood)).toEqual([
      HalloweenSpiderMood.Wrapping,
      HalloweenSpiderMood.Idle,
      HalloweenSpiderMood.Startled,
      HalloweenSpiderMood.Idle,
    ]);
  });

  it('keeps the thread exactly as long as the spider hangs', () => {
    plan.dangle.forEach((frame, index) => {
      const depth = /translateY\((-?[\d.]+)px/.exec(
        String(frame.transform),
      )?.[1];
      expect(plan.thread[index].transform).toBe(`scaleY(${depth})`);
    });
  });
});

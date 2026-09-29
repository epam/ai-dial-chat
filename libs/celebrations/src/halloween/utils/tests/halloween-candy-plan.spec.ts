import { describe, expect, it } from 'vitest';
import {
  buildCandyPlan,
  candyBeakPoint,
  CANDY_BRUSH,
  CANDY_FRAME_LIMIT,
  CANDY_MS,
  CandyContactKind,
  CandyJanitorKind,
} from '../halloween-candy-plan';
import type { CandyTargets } from '../halloween-candy-targets';
const input = (width = 360, rtl = false): CandyTargets => ({
  width,
  height: 900,
  rtl,
  surfaces: [
    {
      element: document.createElement('div'),
      rect: new DOMRect(40, 400, width - 80, 100),
    },
    {
      element: document.createElement('button'),
      rect: new DOMRect(90, 550, 120, 44),
    },
  ],
});
const coords = (frame: Keyframe) =>
  String(frame.transform)
    .match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)!
    .slice(1)
    .map(Number);
const position = (frames: Keyframe[], time: number) => {
  const offset = time / CANDY_MS;
  const next = frames.findIndex((f) => Number(f.offset) > offset);
  if (next < 0) return coords(frames.at(-1)!);
  const a = frames[Math.max(0, next - 1)],
    b = frames[next],
    p = coords(a),
    q = coords(b);
  const t = (offset - Number(a.offset)) / (Number(b.offset) - Number(a.offset));
  return p.map((v, i) => v + (q[i] - v) * t);
};
describe('Candy cleanup battle plan', () => {
  it('reaches cards below a wider composer without crossing its body', () => {
    const source = input(1280),
      p = buildCandyPlan(source, false);
    expect(
      new Set(
        p.contacts
          .filter((c) => c.kind === CandyContactKind.Edge)
          .map((c) => c.surface),
      ),
    ).toEqual(new Set([0, 1]));
    const composer = source.surfaces[0].rect;
    for (const sweet of p.sweets) {
      for (let time = 0; time <= 4500; time += 10) {
        const [x, y] = position(sweet.frames, time);
        if (y > composer.top + p.radius && y < composer.bottom - p.radius)
          expect(
            x < composer.left - p.radius || x > composer.right + p.radius,
          ).toBe(true);
      }
    }
  });
  it.each([360, 900, 1280, 1920])(
    'keeps every actor, finite tracks and persistent candy at %spx',
    (width) => {
      const mobile = width < 1280,
        p = buildCandyPlan(input(width), mobile);
      expect(p.sweets).toHaveLength(mobile ? 12 : 18);
      expect(p.birds).toHaveLength(mobile ? 4 : 6);
      expect(p.janitors.map((j) => j.kind)).toEqual([
        CandyJanitorKind.Mummy,
        CandyJanitorKind.Skeleton,
        CandyJanitorKind.Skeleton,
      ]);
      const tracks = [
        ...p.sweets.map((s) => s.frames),
        ...p.birds.flatMap((b) => [b.frames, b.head, b.wing, b.facing]),
        ...p.janitors.flatMap((j) => [j.frames, j.arms, j.facing, ...j.legs]),
      ];
      expect(tracks.length).toBeLessThanOrEqual(p.animationLimit);
      for (const frames of tracks) {
        expect(frames.length).toBeLessThanOrEqual(CANDY_FRAME_LIMIT);
        const offsets = frames.map((f) => Number(f.offset));
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
        expect(offsets[0]).toBe(0);
        expect(offsets.at(-1)).toBe(1);
        expect(JSON.stringify(frames)).not.toMatch(/NaN|Infinity/);
      }
      for (const s of p.sweets) {
        expect(position(s.frames, 5000)[1]).toBeCloseTo(p.floor - p.radius);
        expect(position(s.frames, 20000)[0]).toBeGreaterThan(0);
        expect(position(s.frames, 34000)[0]).toBeLessThan(0);
      }
    },
  );
  it.each([false, true])(
    'shares exact edge, beak and broom contact poses, RTL=%s',
    (rtl) => {
      const source = input(1280, rtl),
        p = buildCandyPlan(source, false);
      expect(p.contacts.some((c) => c.kind === CandyContactKind.Edge)).toBe(
        true,
      );
      for (const c of p.contacts) {
        const sweet = position(p.sweets[c.sweet].frames, c.time);
        expect(sweet[0]).toBeCloseTo(c.x);
        expect(sweet[1]).toBeCloseTo(c.y);
        if (c.kind === CandyContactKind.Edge) {
          const rect = source.surfaces[c.surface!].rect;
          const x = rtl ? source.width - c.x : c.x;
          expect(x).toBeGreaterThan(rect.left);
          expect(x).toBeLessThan(rect.right);
          expect(c.y + p.radius).toBeCloseTo(rect.top);
        }
        if (c.kind === CandyContactKind.Peck) {
          const bird = position(p.birds[c.actor!].frames, c.time),
            tip = candyBeakPoint(p.peckAngle);
          expect(bird[0] + tip.x * p.birdScale).toBeCloseTo(c.x);
          expect(bird[1] + tip.y * p.birdScale).toBeCloseTo(c.y);
        }
        if (c.kind === CandyContactKind.Sweep) {
          const janitor = position(p.janitors[c.actor!].frames, c.time);
          expect(janitor[0] + CANDY_BRUSH.x * p.janitorScale).toBeCloseTo(c.x);
          expect(janitor[1] + CANDY_BRUSH.y * p.janitorScale).toBeCloseTo(
            p.floor,
          );
        }
      }
    },
  );
  it('takes both factions fully offscreen before their return and includes a second feast', () => {
    const p = buildCandyPlan(input(), true);
    for (const b of p.birds.slice(0, 2))
      expect(position(b.frames, 14500)[0] + 100 * p.birdScale).toBeLessThan(0);
    expect(position(p.janitors[0].frames, 20000)[0]).toBeGreaterThan(360);
    expect(
      p.contacts.filter(
        (c) => c.kind === CandyContactKind.Peck && c.time > 21000,
      ).length,
    ).toBeGreaterThan(4);
    for (const b of p.birds)
      expect(position(b.frames, 32000)[0] + 100 * p.birdScale).toBeLessThan(0);
    for (const j of p.janitors)
      expect(position(j.frames, 35000)[0] + 160 * p.janitorScale).toBeLessThan(
        0,
      );
  });
  it('retains the whole story without anchors and is deterministic', () => {
    const source = { ...input(), surfaces: [] },
      p = buildCandyPlan(source, true);
    expect(p).toEqual(buildCandyPlan(source, true));
    expect(p.contacts.some((c) => c.kind === CandyContactKind.Edge)).toBe(
      false,
    );
    expect(p.contacts.some((c) => c.kind === CandyContactKind.Sweep)).toBe(
      true,
    );
    expect(p.janitors).toHaveLength(3);
  });
});

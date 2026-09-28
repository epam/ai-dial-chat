import { describe, expect, it } from 'vitest';
import {
  buildFootprintPlan,
  FOOTPRINT_HANDOFF,
  FOOTPRINT_KEYFRAME_LIMIT,
  FOOTPRINT_MS,
  FOOTPRINT_RESTORE,
  FootprintPart,
  FootprintSurface,
} from '../halloween-footprint-plan';
import type { FootprintTargets } from '../halloween-footprint-targets';

const fixture = (width = 1280): FootprintTargets => ({
  width,
  height: 900,
  card: {
    element: document.createElement('button'),
    rect: new DOMRect(width / 2 - 65, 340, 130, 44),
  },
  composer: {
    element: document.createElement('div'),
    rect: new DOMRect(width / 2 - 140, 470, 280, 100),
  },
});
describe('invisible cat contact plan', () => {
  it.each([360, 1280])(
    'steps on the input outline without borrowing the input at %spx',
    (width) => {
      const input = { ...fixture(width), card: undefined };
      const plan = buildFootprintPlan(input, width < 1280);
      expect(plan.card).toBeUndefined();
      expect(plan.ledge).toBe(input.composer);
      expect(plan.anchors).toEqual([input.composer]);
      const contacts = plan.prints.filter(
        (print) => print.surface === FootprintSurface.Composer,
      );
      expect(contacts).toHaveLength(width < 1280 ? 3 : 5);
      for (const print of contacts) {
        expect(print.point.x).toBeGreaterThan(12);
        expect(print.point.x).toBeLessThan(input.composer!.rect.width - 12);
        expect(Math.abs(print.point.y)).toBe(3);
        expect(
          plan.surfaceFrames.find(
            (frame) => frame.offset === print.contactAt / FOOTPRINT_MS,
          )?.transform,
        ).toBe('translateY(0px)');
        expect(
          plan.surfaceFrames.find(
            (frame) => frame.offset === (print.contactAt + 130) / FOOTPRINT_MS,
          )?.transform,
        ).toBe('translateY(1.5px)');
      }
      expect(
        Math.max(...contacts.map((print) => print.point.x)) -
          Math.min(...contacts.map((print) => print.point.x)),
      ).toBeLessThanOrEqual(144);
      expect(plan.surfaceFrames.length).toBeLessThanOrEqual(
        FOOTPRINT_KEYFRAME_LIMIT,
      );
      expect(
        plan.surfaceFrames.every(
          (frame) => !String(frame.transform).includes('rotate'),
        ),
      ).toBe(true);
    },
  );
  it('keeps the decorative fallback when the input has insufficient headroom', () => {
    const input = fixture(360);
    input.card = undefined;
    input.composer!.rect = new DOMRect(40, 30, 280, 90);
    const plan = buildFootprintPlan(input, true);
    expect(plan.ledge).toBeUndefined();
    expect(plan.surfaceFrames).toEqual([]);
  });
  it.each([360, 900, 1280, 1920])(
    'bounds geometry, tracks and alternating steps at %spx',
    (width) => {
      const mobile = width < 1280,
        input = fixture(width),
        plan = buildFootprintPlan(input, mobile);
      expect(plan.prints).toHaveLength(mobile ? 8 : 12);
      for (const print of plan.prints) {
        const x =
          print.point.x +
          (print.surface === FootprintSurface.Card ? input.card!.rect.left : 0);
        const y =
          print.point.y +
          (print.surface === FootprintSurface.Card ? input.card!.rect.top : 0);
        expect(x).toBeGreaterThan(plan.size / 2);
        expect(x).toBeLessThan(width - plan.size / 2);
        expect(y).toBeGreaterThan(plan.size / 2);
        expect(y).toBeLessThan(900 - plan.size / 2);
      }
      const approach = plan.prints.slice(0, mobile ? 3 : 5);
      const lengths = approach
        .slice(1)
        .map((p, i) =>
          Math.hypot(
            p.point.x - approach[i].point.x,
            p.point.y - approach[i].point.y,
          ),
        );
      expect(Math.max(...lengths) / Math.min(...lengths)).toBeCloseTo(1);
      expect(approach[0].frames[3].transform).not.toBe(
        approach[1].frames[3].transform,
      );
      const tracks = [
        plan.surfaceFrames,
        plan.faceFrames,
        ...Object.values(plan.faceParts),
        ...plan.prints.map((p) => p.frames),
      ];
      for (const frames of tracks) {
        expect(frames.length).toBeLessThanOrEqual(FOOTPRINT_KEYFRAME_LIMIT);
        expect(JSON.stringify(frames)).not.toMatch(/NaN|Infinity|undefined/);
        const offsets = frames.map((f) => Number(f.offset));
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
        expect(offsets[0]).toBe(0);
        expect(offsets.at(-1)).toBe(1);
      }
    },
  );
  it('only reacts after each card contact and restores before copy removal', () => {
    const plan = buildFootprintPlan(fixture(), false);
    for (const print of plan.prints.filter(
      (p) => p.surface === FootprintSurface.Card,
    )) {
      const contact = plan.surfaceFrames.find(
        (f) => f.offset === print.contactAt / FOOTPRINT_MS,
      )!;
      expect(contact.transform).toBe('translateY(0px) rotate(0deg)');
      const reaction = plan.surfaceFrames.find(
        (f) => f.offset === (print.contactAt + 130) / FOOTPRINT_MS,
      )!;
      expect(reaction.transform).toContain('translateY(3px)');
      expect(Number(reaction.offset)).toBeGreaterThan(Number(contact.offset));
    }
    const returned = plan.surfaceFrames.find(
      (f) => f.offset === FOOTPRINT_RESTORE,
    )!;
    expect(returned).toMatchObject({
      transform: 'translateY(0px) rotate(0deg)',
      opacity: 1,
      easing: 'steps(1, end)',
    });
    expect(
      plan.surfaceFrames.find((f) => f.offset === FOOTPRINT_HANDOFF)?.opacity,
    ).toBe(0);
    expect(plan.prints.at(-1)!.contactAt).toBeGreaterThan(10000);
    expect(
      plan.faceFrames.find((f) => f.offset === 11600 / FOOTPRINT_MS)?.opacity,
    ).toBe(1);
    expect(
      plan.faceParts[FootprintPart.Grin].find(
        (f) => f.offset === 11700 / FOOTPRINT_MS,
      )?.opacity,
    ).toBe(1);
  });
  it('retains a deterministic no-target story without mutation or borrowed tracks', () => {
    const input = { width: 360, height: 720 };
    const first = buildFootprintPlan(input, true);
    expect(first).toEqual(buildFootprintPlan(input, true));
    expect(input).toEqual({ width: 360, height: 720 });
    expect(first.card).toBeUndefined();
    expect(first.surfaceFrames).toEqual([]);
    expect(first.anchors).toEqual([]);
    expect(first.prints).toHaveLength(8);
    expect(first.prints.every((p) => p.surface === FootprintSurface.Page)).toBe(
      true,
    );
  });
  it('uses physical geometry without mirroring the card in RTL', () => {
    const input = fixture(360);
    const ltr = buildFootprintPlan(input, true);
    document.documentElement.dir = 'rtl';
    try {
      expect(buildFootprintPlan(input, true)).toEqual(ltr);
    } finally {
      document.documentElement.removeAttribute('dir');
    }
    expect(
      ltr.surfaceFrames.some((f) => String(f.transform).includes('scale')),
    ).toBe(false);
  });
});

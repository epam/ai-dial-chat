import { describe, expect, it } from 'vitest';
import {
  buildSkeletonPlan,
  SKELETON_ANIMATION_LIMIT,
  SKELETON_ARM_REST,
  SKELETON_ART,
  SKELETON_FRAME_LIMIT,
  SKELETON_MS,
  SkeletonContactKind,
  skeletonHandPoint,
  type SkeletonActorTracks,
  type SkeletonPlan,
} from '../halloween-skeleton-plan';
import type { SkeletonTargets } from '../halloween-skeleton-targets';

const composer = (left: number, top: number, width: number, height = 96) => ({
  element: document.createElement('div'),
  rect: new DOMRect(left, top, width, height),
  borderRadius: '16px',
});
const targets = (
  overrides: Partial<SkeletonTargets> = {},
): SkeletonTargets => ({
  width: 1280,
  height: 900,
  rtl: false,
  composer: composer(340, 720, 600),
  ...overrides,
});

/* Linear interpolation of emitted numeric values, as WAAPI plays linear segments. */
const numbers = (frame: Keyframe, pattern: RegExp) =>
  [...String(frame.transform).matchAll(pattern)].map((m) => Number(m[1]));
const sampleAt = (frames: Keyframe[], time: number, pattern: RegExp) => {
  const offset = time / SKELETON_MS;
  let previous = frames[0];
  for (const frame of frames) {
    if ((frame.offset as number) > offset) {
      const span = (frame.offset as number) - (previous.offset as number);
      const t = span ? (offset - (previous.offset as number)) / span : 1;
      const a = numbers(previous, pattern),
        b = numbers(frame, pattern);
      return a.map((v, i) => v + (b[i] - v) * t);
    }
    previous = frame;
  }
  return numbers(previous, pattern);
};
const px = /(-?[\d.]+)px/g;
const angle = /rotate\((-?[\d.]+)deg\)/g;
const scaleY = /scale\([\d.]+, ([\d.]+)\)/g;
const tracks = (plan: SkeletonPlan) => [
  ...[plan.showman, plan.partner].flatMap((actor: SkeletonActorTracks) => [
    actor.root,
    actor.facing,
    ...Object.values(actor.parts),
  ]),
  plan.skull.root,
  plan.skull.turn,
  plan.skull.face,
  ...(plan.outline.length ? [plan.outline] : []),
];

describe('Skeleton lost-skull plan', () => {
  it.each([false, true])(
    'keeps every track finite, ordered and within budget, mobile=%s',
    (mobile) => {
      const plan = buildSkeletonPlan(targets(), mobile);
      const all = tracks(plan);
      expect(all).toHaveLength(SKELETON_ANIMATION_LIMIT);
      all.forEach((frames) => {
        expect(frames.length).toBeLessThanOrEqual(SKELETON_FRAME_LIMIT);
        expect(frames[0].offset).toBe(0);
        expect(frames.at(-1)?.offset).toBe(1);
        const offsets = frames.map((f) => f.offset as number);
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      });
    },
  );

  it('orders the story beats and lands both dancers on the composer edge', () => {
    const plan = buildSkeletonPlan(targets(), false);
    const kinds = plan.contacts.map((c) => c.kind);
    const first = (kind: SkeletonContactKind) =>
      plan.contacts.find((c) => c.kind === kind)!.time;
    expect(kinds.filter((k) => k === SkeletonContactKind.Landing)).toHaveLength(
      5,
    );
    expect(first(SkeletonContactKind.Launch)).toBeLessThan(
      first(SkeletonContactKind.Impact),
    );
    expect(first(SkeletonContactKind.Impact)).toBeLessThan(
      first(SkeletonContactKind.Catch),
    );
    expect(first(SkeletonContactKind.Catch)).toBeLessThan(
      first(SkeletonContactKind.Place),
    );
    expect(plan.stageY).toBe(720);
    const { scale } = plan.showman;
    const [, y] = sampleAt(plan.showman.root, 2000, px);
    expect(y + SKELETON_ART.feetY * scale).toBeCloseTo(720, 1);
  });

  it('launches the free skull exactly where the attached skull was hidden', () => {
    const plan = buildSkeletonPlan(targets(), false);
    const s = plan.showman.scale,
      half = plan.skullSize / 2;
    const [x, y] = sampleAt(plan.showman.root, 5200, px);
    const [fx, fy] = sampleAt(plan.skull.root, 5201, px);
    expect(fx + half).toBeCloseTo(x + SKELETON_ART.skull.x * s, 0);
    expect(fy + half).toBeCloseTo(y + SKELETON_ART.skull.y * s, 0);
    const skull = plan.showman.parts.skull!;
    const visible = (time: number) =>
      skull.filter((f) => (f.offset as number) <= time / SKELETON_MS).at(-1)
        ?.opacity;
    expect(visible(5100)).toBe(1);
    expect(visible(6000)).toBe(0);
    expect(visible(9500)).toBe(1);
  });

  it('dips the outline only after each landing or impact', () => {
    const plan = buildSkeletonPlan(targets(), false);
    const dips = plan.outline.filter(
      (f) => numbers(f, /translateY\((-?[\d.]+)px\)/g)[0] > 0,
    );
    const surfaced = plan.contacts
      .filter((c) =>
        [SkeletonContactKind.Landing, SkeletonContactKind.Impact].includes(
          c.kind,
        ),
      )
      .map((c) => c.time / SKELETON_MS);
    expect(dips.length).toBeGreaterThanOrEqual(surfaced.length);
    dips.forEach((dip) =>
      expect(
        surfaced.some(
          (time) =>
            (dip.offset as number) > time &&
            (dip.offset as number) - time < 100 / SKELETON_MS,
        ),
      ).toBe(true),
    );
  });

  it.each([false, true])(
    'keeps the held skull on the partner hand from catch to placement, mobile=%s',
    (mobile) => {
      const plan = buildSkeletonPlan(targets(), mobile);
      const { partner } = plan;
      const rs = SKELETON_ART.skullRadius * plan.showman.scale;
      expect(plan.holds.length).toBeGreaterThan(20);
      plan.holds.forEach(({ time, hand, skull }) => {
        const [x, y] = sampleAt(partner.root, time, px);
        const [, dy] = sampleAt(partner.parts.body!, time, px);
        expect(sampleAt(partner.parts.body!, time, scaleY)[0]).toBeCloseTo(1);
        const [rotation] = sampleAt(partner.parts['arm-right']!, time, angle);
        const facing = time < 8300 ? 1 : -1;
        const expected = skeletonHandPoint(
          { x, y },
          partner.scale,
          facing,
          dy,
          rotation + SKELETON_ARM_REST,
        );
        expect(hand.x).toBeCloseTo(expected.x, 0);
        expect(hand.y).toBeCloseTo(expected.y, 0);
        const [fx, fy] = sampleAt(plan.skull.root, time, px);
        expect(fx + plan.skullSize / 2).toBeCloseTo(skull.x, 0);
        expect(fy + plan.skullSize / 2).toBeCloseTo(skull.y, 0);
        expect(skull.y - hand.y).toBeCloseTo(rs, 5);
        /* Lifted over the edge, the skull never sinks into the composer. */
        if (time > 8000) expect(skull.y + rs).toBeLessThanOrEqual(720 + 0.5);
      });
      const catchContact = plan.contacts.find(
        (c) => c.kind === SkeletonContactKind.Catch,
      )!;
      expect(plan.holds[0].skull.x).toBeCloseTo(catchContact.x, 1);
      expect(plan.holds[0].skull.y).toBeCloseTo(catchContact.y, 1);
      const place = plan.contacts.find(
        (c) => c.kind === SkeletonContactKind.Place,
      )!;
      expect(plan.holds.at(-1)!.skull.x).toBeCloseTo(place.x, 1);
      expect(plan.holds.at(-1)!.skull.y).toBeCloseTo(place.y, 1);
      const [ax, ay] = sampleAt(plan.showman.root, 9400, px);
      expect(place.x).toBeCloseTo(
        ax + SKELETON_ART.skull.x * plan.showman.scale,
        1,
      );
      expect(place.y).toBeCloseTo(
        ay + SKELETON_ART.skull.y * plan.showman.scale,
        1,
      );
    },
  );

  it('turns the partner only while the hand is on the body axis', () => {
    const plan = buildSkeletonPlan(targets(), false);
    [8250, 8300, 8350].forEach((time) => {
      const hold = plan.holds.find((h) => h.time === time)!;
      const [x] = sampleAt(plan.partner.root, time, px);
      expect(hold.hand.x - x).toBeCloseTo(50 * plan.partner.scale, 1);
    });
  });

  it('catches the teetering skull at the physical composer corner', () => {
    const plan = buildSkeletonPlan(targets(), false);
    const catchContact = plan.contacts.find(
      (c) => c.kind === SkeletonContactKind.Catch,
    )!;
    expect(catchContact.x).toBeGreaterThan(930);
    expect(catchContact.x).toBeLessThan(945);
    const [partnerX] = sampleAt(plan.partner.root, 7900, px);
    expect(partnerX + 50 * plan.partner.scale).toBeLessThan(940);
  });

  it('mirrors the stage in RTL so the corner stays at the physical inline end', () => {
    const plan = buildSkeletonPlan(targets({ rtl: true }), false);
    expect(plan.ledge?.left).toBeCloseTo(1280 - 940);
    const catchContact = plan.contacts.find(
      (c) => c.kind === SkeletonContactKind.Catch,
    )!;
    /* Plan space is mirrored by the layer: 1280 - x is the physical position. */
    expect(1280 - catchContact.x).toBeLessThan(350);
  });

  it.each([
    ['without a composer', { composer: undefined }],
    [
      'with a composer too high for the jump',
      { composer: composer(340, 90, 600) },
    ],
    [
      'with a composer too narrow for two dancers',
      { composer: composer(340, 720, 150) },
    ],
  ])('plays the same beats on the viewport floor %s', (_, overrides) => {
    const plan = buildSkeletonPlan(targets(overrides), false);
    expect(plan.ledge).toBeUndefined();
    expect(plan.anchors).toEqual([]);
    expect(plan.outline).toEqual([]);
    expect(plan.stageY).toBe(894);
    expect(tracks(plan)).toHaveLength(SKELETON_ANIMATION_LIMIT - 1);
    expect(plan.contacts.map((c) => c.kind)).toContain(
      SkeletonContactKind.Place,
    );
  });

  it('is deterministic for identical geometry', () => {
    expect(JSON.stringify(buildSkeletonPlan(targets(), true))).toBe(
      JSON.stringify(buildSkeletonPlan(targets(), true)),
    );
  });
});

/* Geometry fixtures need measured DOM nodes rather than interactive queries. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSnowmanFixture,
  resetSnowmanFixture,
  SNOWMAN_ANCHORS,
} from '../../../test-utils/snowman-fixtures';
import { REINDEER_PLAYBACK } from '../reindeer-animation';
import {
  buildReindeerComposition,
  REINDEER_BEATS as B,
  REINDEER_TAKEOFF_MS,
} from '../reindeer-composition';
import { prepareReindeerScene } from '../reindeer-scene';
import type { ReindeerTargets } from '../reindeer-targets';

const targets = (dir = 1): ReindeerTargets => ({
  width: 1280,
  height: 900,
  dir,
  scale: 0.85,
  origin: [640, 700],
  catchPoint: [640 - dir * 50, 610],
  bounds: dir === 1 ? { left: 240, right: 1280 } : { left: 0, right: 1040 },
  rim: dir === 1 ? { left: 240, right: 1280 } : { left: 0, right: 1040 },
  composer: null,
  word: null,
  watched: [],
  isStatic: false,
});
describe('reindeer takeoff', () => {
  afterEach(() => {
    resetSnowmanFixture();
    vi.restoreAllMocks();
  });

  describe('reindeer story geometry', () => {
    it.each([360, 900, 1280, 1920])(
      'walks across the stage and keeps the airborne cast visible at %s px',
      (width) => {
        buildSnowmanFixture({
          width,
          height: 900,
          composer: null,
          starters: null,
          heading: null,
        });
        const scene = prepareReindeerScene({}, width < 1280);
        const { scale, bounds } = scene.targets;
        const entry = scene.probe(0).adult[0];
        const stopped = scene.probe(B.caught).adult[0];
        expect(entry + 80 * scale).toBeLessThan(bounds.left);
        expect(stopped - entry).toBeGreaterThan(
          (bounds.right - bounds.left) * 0.5,
        );
        for (let t = 18; t <= 20.5; t += 0.1) {
          const { adult, calf, sleigh } = scene.probe(t);
          for (const [x, y] of [adult, calf, sleigh]) {
            expect(x - 65 * scale).toBeGreaterThanOrEqual(bounds.left);
            expect(x + 90 * scale).toBeLessThanOrEqual(bounds.right);
            expect(y - 165 * scale).toBeGreaterThanOrEqual(0);
            expect(y + 10 * scale).toBeLessThanOrEqual(900);
          }
        }
        expect(scene.probe(B.exit).sleigh[0] - 65 * scale).toBeGreaterThan(
          bounds.right,
        );
      },
    );
    it.each([false, true])(
      'holds the catch until the successful nudge and restores before takeoff, mobile=%s',
      (isMobile) => {
        const scene = buildReindeerComposition(targets(), isMobile);
        expect(scene.probe(B.pull - 0.01).displacement).toBe(0);
        expect(scene.probe(B.strongEnd).displacement).toBeGreaterThan(
          scene.probe(B.pullEnd).displacement,
        );
        const failed = scene.probe(B.failedNudge);
        expect(
          Math.hypot(
            failed.nose[0] - failed.loop[0],
            failed.nose[1] - failed.loop[1],
          ),
        ).toBeGreaterThan(3);
        for (let t = B.grip; t <= B.release; t += 1 / 60)
          expect(scene.probe(t).loop).toEqual(scene.probe(t).nose);
        expect(scene.probe(B.grip).nose[0]).toBeCloseTo(
          scene.probe(B.grip).catchPoint[0],
          3,
        );
        expect(scene.probe(B.grip).nose[1]).toBeCloseTo(
          scene.probe(B.grip).catchPoint[1],
          3,
        );
        expect(scene.probe(B.release).loop[1]).toBeLessThan(
          scene.probe(B.grip).loop[1],
        );
        expect(scene.probe(B.restored).displacement).toBe(0);
        expect(scene.probe(B.launch).adult[1]).toBe(700);
        expect(scene.probe(B.flight).adult[1]).toBeLessThan(700);
      },
    );
    it.each([1, -1])(
      'lifts the word to the grounded calf and restores it before flight, dir=%s',
      (dir) => {
        const stage = targets(dir);
        stage.word = {
          element: document.createElement('textarea'),
          rect: new DOMRect(570, 730, 60, 20),
          text: 'Winter',
          style: {},
          background: 'rgb(255, 255, 255)',
        };
        stage.catchPoint = [600, 748];
        const scene = buildReindeerComposition(stage, false);
        expect(scene.probe(B.grip).calf[1]).toBeCloseTo(stage.origin[1]);
        expect(scene.probe(B.grip).nose[0]).toBeCloseTo(
          scene.probe(B.grip).catchPoint[0],
        );
        expect(scene.probe(B.grip).nose[1]).toBeCloseTo(
          scene.probe(B.grip).catchPoint[1],
        );
        expect(scene.probe(B.strongEnd).catchPoint[1]).toBeLessThan(
          stage.origin[1],
        );
        expect(scene.probe(B.restored).catchPoint).toEqual(stage.catchPoint);
      },
    );
    it('mirrors the vector story using measured positions', () => {
      const ltr = buildReindeerComposition(targets(), false);
      const rtl = buildReindeerComposition(targets(-1), false);
      for (const t of [4, 10, B.grip, B.release, 18]) {
        expect(rtl.probe(t).nose[0]).toBeCloseTo(1280 - ltr.probe(t).nose[0]);
        expect(rtl.probe(t).nose[1]).toBeCloseTo(ltr.probe(t).nose[1]);
      }
    });
    it('takes up the airborne load in order and keeps forward momentum', () => {
      const scene = buildReindeerComposition(targets(), false);
      const floor = scene.probe(B.launch).adult[1];
      expect(scene.probe(16.3).adult[1]).toBeLessThan(floor);
      expect(scene.probe(16.3).calf[1]).toBe(floor);
      expect(scene.probe(16.45).calf[1]).toBeLessThan(floor);
      expect(scene.probe(16.45).sleigh[1]).toBe(floor);
      expect(scene.probe(16.7).sleigh[1]).toBeLessThan(floor);
      for (const time of [17.2, 18.6, 20.5]) {
        const before = scene.probe(time - 0.02).adult;
        const at = scene.probe(time).adult;
        const after = scene.probe(time + 0.02).adult;
        expect(after[0]).toBeGreaterThan(at[0]);
        expect(at[0]).toBeGreaterThan(before[0]);
        for (let axis = 0; axis < 2; axis++)
          expect(
            Math.abs((after[axis] - 2 * at[axis] + before[axis]) / 0.02),
          ).toBeLessThan(15);
      }
    });
    it.each([
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ])(
      'keeps the authored payload within the agreed budget, mobile=%s, word=%s',
      (isMobile, hasWord) => {
        const stage = targets();
        if (hasWord)
          stage.word = {
            element: document.createElement('textarea'),
            text: 'Winter',
            background: 'rgb(255, 255, 255)',
            style: {},
            rect: new DOMRect(568, 568, 44, 44),
          };
        const scene = buildReindeerComposition(stage, isMobile);
        let properties = 0;
        let keys = 0;
        let maxKeys = 0;
        let paths = 0;
        let vertices = 0;
        const inspect = (value: unknown) => {
          if (!value || typeof value !== 'object') return;
          const item = value as Record<string, unknown>;
          if (item.a === 1 && Array.isArray(item.k)) {
            properties++;
            keys += item.k.length;
            maxKeys = Math.max(maxKeys, item.k.length);
          }
          if (item.ty === 'sh') {
            paths++;
            const shape = item.ks as {
              a: number;
              k: { v?: unknown[] } | { s: { v: unknown[] }[] }[];
            };
            if (shape.a === 0 && !Array.isArray(shape.k))
              vertices += shape.k.v?.length ?? 0;
            else if (Array.isArray(shape.k))
              vertices += shape.k[0].s[0].v.length;
          }
          Object.values(item).forEach((child) => {
            if (Array.isArray(child)) child.forEach(inspect);
            else inspect(child);
          });
        };
        inspect(scene.animationData);
        expect(
          new TextEncoder().encode(JSON.stringify(scene.animationData)).length,
        ).toBeLessThanOrEqual(500_000);
        expect(properties).toBeLessThanOrEqual(110);
        expect(keys).toBeLessThanOrEqual(7000);
        expect(maxKeys).toBeLessThanOrEqual(380);
        expect(paths).toBeLessThanOrEqual(140);
        /* Animated ribbon vertices count once per distinct path, not once per key. */
        expect(vertices).toBeLessThanOrEqual(2000);
        expect(scene.animationData.layers.length).toBeLessThanOrEqual(24);
        expect(scene.particleCount).toBeLessThanOrEqual(isMobile ? 16 : 24);
        expect((scene.animationData.op / scene.animationData.fr) * 1000).toBe(
          REINDEER_TAKEOFF_MS,
        );
        expect(
          REINDEER_PLAYBACK.timings.loadTimeoutMs +
            REINDEER_PLAYBACK.timings.readyTimeoutMs +
            REINDEER_TAKEOFF_MS,
        ).toBeLessThanOrEqual(25500);
        const data = JSON.stringify(scene.animationData);
        expect(data).not.toMatch(
          /"(?:ef|masksProperties|fonts|chars)":|data:image|https?:/,
        );
      },
    );
  });

  describe('reindeer stage selection', () => {
    it.each([360, 900, 1280, 1920])(
      'puts every grounded root on the composer rim at %s px',
      (width) => {
        const rect = {
          left: (width - Math.min(560, width - 32)) / 2,
          top: 400,
          width: Math.min(560, width - 32),
          height: 100,
        };
        buildSnowmanFixture({ width, composer: rect });
        const scene = prepareReindeerScene(SNOWMAN_ANCHORS, width < 1280);
        expect(scene.targets.composer).not.toBeNull();
        expect(scene.targets.origin[1]).toBe(rect.top - 2);
        for (const t of [B.caught, B.pull, B.strongEnd, B.launch]) {
          const { adult, calf, sleigh } = scene.probe(t);
          for (const [x, y] of [adult, calf, sleigh]) {
            expect(y).toBeCloseTo(rect.top - 2);
            expect(x).toBeGreaterThan(rect.left);
            expect(x).toBeLessThan(rect.left + rect.width);
          }
        }
      },
    );
    it('keeps a decorative stage without host anchors', () => {
      buildSnowmanFixture({ composer: null, starters: null, heading: null });
      const scene = prepareReindeerScene({}, false);
      expect(scene.targets.word).toBeNull();
      expect(
        scene.animationData.layers.some(({ nm }) => nm === 'snow-wake'),
      ).toBe(true);
    });
    it('uses the top of a bottom-pinned composer without needing space below it', () => {
      buildSnowmanFixture({
        composer: { left: 360, top: 750, width: 560, height: 100 },
        starters: null,
      });
      expect(
        prepareReindeerScene(SNOWMAN_ANCHORS, false).targets.origin[1],
      ).toBe(748);
    });
    it('uses a still when a supplied composer has insufficient headroom', () => {
      buildSnowmanFixture({
        composer: { left: 360, top: 60, width: 560, height: 100 },
      });
      expect(() => prepareReindeerScene(SNOWMAN_ANCHORS, false)).toThrow(
        'No clear reindeer stage',
      );
    });
  });
});

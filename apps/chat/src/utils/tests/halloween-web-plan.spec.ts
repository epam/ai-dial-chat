import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HALLOWEEN_MOBILE_WEB_COUNT,
  HALLOWEEN_WEB_COUNT,
} from '../../constants/halloween';
import {
  buildHalloweenWebPlan,
  type HalloweenWebPlan,
  type Point,
} from '../halloween-web-plan';

const seededRandom = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
};
const pointsIn = (plan: HalloweenWebPlan) => [
  ...plan.webs.flatMap((web) => [...web.silk, ...web.spokes.flat()]),
  ...plan.strands.flatMap((strand) => strand.points),
];
const connectedNodes = (plan: HalloweenWebPlan) => {
  const neighbors = plan.webs.map(() => new Set<number>());
  for (const strand of plan.strands) {
    if (strand.from === undefined || strand.to === undefined)
      throw new Error('A mesh bridge must name its two web anchors');
    neighbors[strand.from].add(strand.to);
    neighbors[strand.to].add(strand.from);
  }
  const visited = new Set<number>();
  const queue = [0];
  while (queue.length) {
    const next = queue.pop();
    if (next === undefined || visited.has(next)) continue;
    visited.add(next);
    queue.push(...neighbors[next]);
  }
  return visited;
};
const outside = (
  point: Point,
  bounds: { left: number; top: number; width: number; height: number },
) =>
  !Number.isFinite(point.x) ||
  !Number.isFinite(point.y) ||
  point.x < bounds.left - 0.000001 ||
  point.y < bounds.top - 0.000001 ||
  point.x > bounds.left + bounds.width + 0.000001 ||
  point.y > bounds.top + bounds.height + 0.000001;

const viewports = [
  { width: 360, height: 800 },
  { width: 900, height: 800 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
];

describe('canvas Halloween web plan', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(viewports)(
    'covers the $width × $height viewport with a connected, bounded mesh at both densities',
    ({ width, height }) => {
      for (const isMobile of [true, false]) {
        vi.spyOn(Math, 'random').mockImplementation(seededRandom(width));
        const plan = buildHalloweenWebPlan({ width, height, isMobile });
        expect(plan.width).toBe(width);
        expect(plan.height).toBe(height);
        expect(plan.webs).toHaveLength(
          isMobile ? HALLOWEEN_MOBILE_WEB_COUNT : HALLOWEEN_WEB_COUNT,
        );
        expect(connectedNodes(plan).size).toBe(plan.webs.length);
        const points = pointsIn(plan);
        expect(points.length).toBeLessThan(40000);
        expect(
          points.filter((point) =>
            outside(point, { left: 0, top: 0, width, height }),
          ),
        ).toEqual([]);
        expect(Math.min(...plan.webs.map((web) => web.x))).toBeLessThan(
          width * 0.15,
        );
        expect(Math.max(...plan.webs.map((web) => web.x))).toBeGreaterThan(
          width * 0.85,
        );
        expect(Math.min(...plan.webs.map((web) => web.y))).toBeLessThan(
          height * 0.15,
        );
        expect(Math.max(...plan.webs.map((web) => web.y))).toBeGreaterThan(
          height * 0.85,
        );
        const screenSections = new Set(
          plan.webs.map(
            (web) =>
              `${Math.floor((web.x / width) * 4)}:${Math.floor((web.y / height) * 4)}`,
          ),
        );
        expect(screenSections.size).toBe(16);
        for (const web of plan.webs) {
          const maximumRadius = Math.max(
            ...[...web.silk, ...web.spokes.flat()].map((point) =>
              Math.hypot(point.x - web.x, point.y - web.y),
            ),
          );
          expect(maximumRadius * 2).toBeLessThanOrEqual(isMobile ? 68 : 108);
        }
        for (const strand of plan.strands) {
          const from = plan.webs[strand.from ?? -1];
          const to = plan.webs[strand.to ?? -1];
          expect(strand.points[0]).toEqual({ x: from.x, y: from.y });
          expect(strand.points.at(-1)).toEqual({ x: to.x, y: to.y });
          expect(strand.delayMs).toBeGreaterThanOrEqual(
            Math.min(from.delayMs, to.delayMs),
          );
          expect(strand.delayMs + strand.durationMs).toBeLessThan(13600);
        }
      }
    },
  );

  it.each([true, false])(
    'finishes weaving before escape and sends every spider offscreen by the deadline (mobile=%s)',
    (isMobile) => {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(234));
      const plan = buildHalloweenWebPlan({
        width: 1280,
        height: 800,
        isMobile,
      });
      expect(new Set(plan.webs.map((web) => web.delayMs)).size).toBe(
        plan.webs.length,
      );
      expect(Math.min(...plan.webs.map((web) => web.delayMs))).toBe(0);
      expect(Math.max(...plan.webs.map((web) => web.delayMs))).toBe(4200);
      const escapeSides = new Set<number>();
      for (const web of plan.webs) {
        expect(web.spiderSize).toBeGreaterThanOrEqual(isMobile ? 16 : 21);
        expect(web.spiderSize).toBeLessThanOrEqual(isMobile ? 21 : 27);
        expect(web.weaveMs).toBeGreaterThanOrEqual(2800);
        expect(web.weaveMs).toBeLessThanOrEqual(4100);
        expect(web.escapeDelayMs).toBeGreaterThan(
          web.delayMs + 800 + web.weaveMs,
        );
        expect(web.escapeDelayMs + web.escapeMs).toBeLessThanOrEqual(13600);
        expect(web.silk[0]).toEqual({ x: web.x, y: web.y });
        expect(web.spokes).toHaveLength(12);
        const end = web.silk.at(-1);
        if (!end) throw new Error('Expected a weaving path');
        expect(
          web.spokes.some((spoke) => {
            const endpoint = spoke.at(-1);
            return (
              endpoint &&
              Math.hypot(endpoint.x - end.x, endpoint.y - end.y) < 0.001
            );
          }),
        ).toBe(true);
        if (web.escape.x < 0) {
          escapeSides.add(0);
          expect(web.escape.x + web.spiderSize).toBeLessThan(0);
        } else if (web.escape.x > plan.width) {
          escapeSides.add(1);
          expect(web.escape.x - web.spiderSize).toBeGreaterThan(plan.width);
        } else if (web.escape.y < 0) {
          escapeSides.add(2);
          expect(web.escape.y + web.spiderSize).toBeLessThan(0);
        } else {
          escapeSides.add(3);
          expect(web.escape.y - web.spiderSize).toBeGreaterThan(plan.height);
        }
      }
      expect(escapeSides.size).toBe(4);
    },
  );

  it('changes positions, arrival order, silk, diagonal bridges and departures between scenes', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(11));
    const first = buildHalloweenWebPlan({
      width: 1280,
      height: 800,
      isMobile: false,
    });
    vi.mocked(Math.random).mockImplementation(seededRandom(22));
    const second = buildHalloweenWebPlan({
      width: 1280,
      height: 800,
      isMobile: false,
    });
    expect(first.webs.map(({ x, y }) => [x, y])).not.toEqual(
      second.webs.map(({ x, y }) => [x, y]),
    );
    expect(first.webs.map(({ delayMs }) => delayMs)).not.toEqual(
      second.webs.map(({ delayMs }) => delayMs),
    );
    expect(first.webs[0].silk).not.toEqual(second.webs[0].silk);
    expect(first.strands.map(({ from, to }) => [from, to])).not.toEqual(
      second.strands.map(({ from, to }) => [from, to]),
    );
    expect(first.webs.map(({ escape }) => escape)).not.toEqual(
      second.webs.map(({ escape }) => escape),
    );
    expect(connectedNodes(first).size).toBe(first.webs.length);
    expect(connectedNodes(second).size).toBe(second.webs.length);
  });

  it.each(viewports)(
    'attaches fans to every eligible UI target without moving most coverage anchors at width $width',
    ({ width, height }) => {
      for (const mirrored of [false, true]) {
        const targetWidth = Math.min(240, width - 24);
        const targets = Array.from({ length: 12 }, (_, index) => ({
          left: mirrored ? width - targetWidth - 12 : 12,
          top: 60 + index * 44,
          width: targetWidth,
          height: 36,
        }));
        const snapshot = structuredClone(targets);
        vi.spyOn(Math, 'random').mockImplementation(seededRandom(width));
        const plan = buildHalloweenWebPlan({
          width,
          height,
          isMobile: width === 360,
          targets,
        });
        const attached = plan.webs.filter(
          (web) => web.targetIndex !== undefined,
        );
        expect(new Set(attached.map((web) => web.targetIndex)).size).toBe(
          targets.length,
        );
        expect(attached.length).toBeLessThanOrEqual(targets.length * 2);
        expect(plan.webs.length - attached.length).toBeGreaterThan(
          plan.webs.length / 2,
        );
        expect(connectedNodes(plan).size).toBe(plan.webs.length);
        expect(pointsIn(plan).length).toBeLessThan(40000);
        expect(targets).toEqual(snapshot);
        expect(Math.min(...plan.webs.map((web) => web.x))).toBeLessThan(
          width * 0.15,
        );
        expect(Math.max(...plan.webs.map((web) => web.x))).toBeGreaterThan(
          width * 0.85,
        );
        expect(Math.min(...plan.webs.map((web) => web.y))).toBeLessThan(
          height * 0.15,
        );
        expect(Math.max(...plan.webs.map((web) => web.y))).toBeGreaterThan(
          height * 0.85,
        );
        const occupiedSections = new Set(
          plan.webs.map(
            (web) =>
              `${Math.floor((web.x / width) * 4)}:${Math.floor((web.y / height) * 4)}`,
          ),
        );
        expect(occupiedSections.size).toBeGreaterThanOrEqual(14);
        for (const web of attached) {
          const target = targets[web.targetIndex ?? -1];
          expect(
            attached.filter((other) => other.targetIndex === web.targetIndex)
              .length,
          ).toBeLessThanOrEqual(2);
          expect(
            [...web.silk, ...web.spokes.flat()].filter((point) =>
              outside(point, target),
            ),
          ).toEqual([]);
          expect(
            Math.max(
              ...[...web.silk, ...web.spokes.flat()].map((point) =>
                Math.hypot(point.x - web.x, point.y - web.y),
              ),
            ),
          ).toBeLessThanOrEqual(width === 360 ? 34 : 54);
          const edgeX = Math.min(
            web.x - target.left,
            target.left + target.width - web.x,
          );
          const edgeY = Math.min(
            web.y - target.top,
            target.top + target.height - web.y,
          );
          expect(edgeX).toBeGreaterThan(0);
          expect(edgeX).toBeLessThanOrEqual(6);
          expect(edgeY).toBeGreaterThan(0);
          expect(edgeY).toBeLessThanOrEqual(6);
          const spokeEnds = web.spokes.map((spoke) => spoke.at(-1));
          expect(
            spokeEnds.some(
              (point) => point && Math.abs(point.y - web.y) < 0.001,
            ),
          ).toBe(true);
          expect(
            spokeEnds.some(
              (point) => point && Math.abs(point.x - web.x) < 0.001,
            ),
          ).toBe(true);
        }
      }
    },
  );

  it('limits eligible UI targets to twelve and skips unavailable geometry without corrupting indexes', () => {
    const targets = [
      { left: Number.NaN, top: 0, width: 100, height: 40 },
      { left: 1500, top: 0, width: 100, height: 40 },
      { left: 0, top: 0, width: 0, height: 40 },
      ...Array.from({ length: 15 }, (_, index) => ({
        left: 20,
        top: 20 + index * 44,
        width: 220,
        height: 36,
      })),
    ];
    const plan = buildHalloweenWebPlan({
      width: 1280,
      height: 800,
      isMobile: false,
      targets,
    });
    expect(
      [
        ...new Set(
          plan.webs.flatMap((web) =>
            web.targetIndex === undefined ? [] : [web.targetIndex],
          ),
        ),
      ].sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 12 }, (_, index) => index + 3));
  });

  it('keeps clipped UI fans inside both the target and the viewport', () => {
    const targets = [
      { left: -40, top: -10, width: 180, height: 100 },
      { left: 300, top: 760, width: 180, height: 100 },
    ];
    const plan = buildHalloweenWebPlan({
      width: 360,
      height: 800,
      isMobile: true,
      targets,
    });
    expect(
      new Set(
        plan.webs.flatMap((web) =>
          web.targetIndex === undefined ? [] : [web.targetIndex],
        ),
      ).size,
    ).toBe(2);
    expect(
      pointsIn(plan).filter((point) =>
        outside(point, { left: 0, top: 0, width: 360, height: 800 }),
      ),
    ).toEqual([]);
    for (const web of plan.webs) {
      if (web.targetIndex !== undefined)
        expect(
          [...web.silk, ...web.spokes.flat()].filter((point) =>
            outside(point, targets[web.targetIndex ?? -1]),
          ),
        ).toEqual([]);
    }
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'does not produce invalid paths for an unavailable viewport (%s)',
    (size) => {
      expect(
        buildHalloweenWebPlan({ width: size, height: 800, isMobile: true })
          .webs,
      ).toEqual([]);
      expect(
        buildHalloweenWebPlan({ width: 1280, height: size, isMobile: false })
          .strands,
      ).toEqual([]);
    },
  );
});

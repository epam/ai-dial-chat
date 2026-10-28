import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildSnowmanFixture,
  resetSnowmanFixture,
  SNOWMAN_ANCHORS,
  type SnowmanFixture,
  stubAnimate,
} from '../../../test-utils/snowman-fixtures';
import { SnowmanStage } from '../../types/new-year';
import { SNOWMAN_DELIVERY_TIMINGS } from '../snowman-delivery-animation';
import {
  armArt,
  bodyArt,
  branchArt,
  footArt,
  headArt,
  needlesArt,
  presentArt,
  puffArt,
  scarfArt,
  sledArt,
  snowbankArt,
  treeArt,
} from '../snowman-delivery-art';
import {
  buildSnowmanDeliveryComposition,
  SNOWMAN_BEATS as B,
  SNOWMAN_DELIVERY_MS,
  SnowmanContactKind,
  type SnowmanDeliveryComposition,
} from '../snowman-delivery-composition';
import { SNOWMAN_RIG } from '../snowman-delivery-rig';
import { getSnowmanDeliveryTargets } from '../snowman-delivery-targets';

type Point = [number, number];
const FPS = 60;
const END = SNOWMAN_DELIVERY_MS / 1000;
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const frames = (t0: number, t1: number) =>
  Array.from(
    { length: Math.floor((t1 - t0) * FPS) + 1 },
    (_, i) => t0 + i / FPS,
  ).filter((t) => t <= t1 + 1e-9);

interface Scenario {
  name: string;
  isMobile: boolean;
  mode: SnowmanStage;
  fixture: SnowmanFixture;
}

const desktopLedge = (width: number, rtl: boolean): SnowmanFixture => {
  const centre = (width + 240) / 2;
  return {
    width,
    rtl,
    region: { left: 240, top: 0, width: width - 240, height: 900 },
    heading: { left: centre - 200, top: 300, width: 400, height: 40 },
    composer: { left: centre - 280, top: 380, width: 560, height: 100 },
    starters: { left: centre - 220, top: 500, width: 440, height: 40 },
    cards: [0, 1, 2].map((i) => ({
      left: centre - 220 + i * 150,
      top: 500,
      width: 140,
      height: 40,
    })),
  };
};
const mobileLedge = (width: number): SnowmanFixture => ({
  width,
  height: 900,
  heading: { left: 40, top: 150, width: width - 80, height: 30 },
  composer: { left: 16, top: 220, width: width - 32, height: 90 },
  starters: { left: 24, top: 330, width: width - 48, height: 36 },
  cards: [
    { left: 24, top: 330, width: 120, height: 36 },
    { left: 152, top: 330, width: 120, height: 36 },
  ],
});

const scenarios: Scenario[] = [
  {
    name: 'desktop 1280 ledge',
    isMobile: false,
    mode: SnowmanStage.Ledge,
    fixture: desktopLedge(1280, false),
  },
  {
    name: 'desktop 1920 RTL ledge',
    isMobile: false,
    mode: SnowmanStage.Ledge,
    fixture: desktopLedge(1920, true),
  },
  {
    name: 'mobile 360 ledge',
    isMobile: true,
    mode: SnowmanStage.Ledge,
    fixture: mobileLedge(360),
  },
  {
    name: 'mobile 900 RTL ledge',
    isMobile: true,
    mode: SnowmanStage.Ledge,
    fixture: { ...mobileLedge(900), rtl: true },
  },
  {
    name: 'desktop rim with a drawn sled',
    isMobile: false,
    mode: SnowmanStage.RimSled,
    fixture: {
      heading: { left: 440, top: 100, width: 400, height: 40 },
      starters: null,
    },
  },
  {
    name: 'desktop platform below a crowded rim',
    isMobile: false,
    mode: SnowmanStage.Platform,
    fixture: {
      starters: { left: 360, top: 340, width: 560, height: 40 },
      cards: [0, 1, 2, 3, 4].map((i) => ({
        left: 360 + i * 112,
        top: 340,
        width: 100,
        height: 40,
      })),
    },
  },
];

beforeEach(() => {
  stubAnimate();
});
afterEach(() => {
  resetSnowmanFixture();
});

const build = (scenario: Scenario): SnowmanDeliveryComposition => {
  buildSnowmanFixture(scenario.fixture);
  const targets = getSnowmanDeliveryTargets(SNOWMAN_ANCHORS, scenario.isMobile);
  expect(targets.mode).toBe(scenario.mode);
  return buildSnowmanDeliveryComposition(targets, scenario.isMobile);
};

const contact = (plan: SnowmanDeliveryComposition, kind: SnowmanContactKind) =>
  plan.contacts.find((item) => item.kind === kind)?.t ?? NaN;

describe.each(scenarios)('snowman delivery plan: $name', (scenario) => {
  it('keeps the beats in story order within the authored timeline', () => {
    const times = Object.values(B);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(Math.max(...times)).toBeLessThan(END);
    const plan = build(scenario);
    expect(plan.animationData.op).toBe(END * FPS);
  });

  it('stops the sled, then compresses the body, then lets the head fly on', () => {
    const plan = build(scenario);
    const { scale } = plan.targets;
    const sledX = (t: number) => plan.probe(t).sled?.corner[0] ?? NaN;
    const before = sledX(B.impact - 1 / FPS);
    expect(Math.abs(sledX(B.impact) - before)).toBeGreaterThan(0.01);
    for (const t of frames(B.impact, B.impact + 0.5))
      expect(sledX(t)).toBeCloseTo(sledX(B.impact), 6);
    /* The body squashes from the very next frame. */
    const height = (t: number) =>
      distance(plan.probe(t).neck, plan.probe(t).seat);
    expect(height(B.impact + 1 / FPS)).toBeLessThan(height(B.impact) - 0.01);
    /* The head rides the neck for at least three frames after contact. */
    for (const t of frames(B.impact, B.impact + 2 / FPS)) {
      const probe = plan.probe(t);
      expect(probe.headAttached).toBe(true);
    }
    expect(
      contact(plan, SnowmanContactKind.HeadLaunch) - B.impact,
    ).toBeGreaterThanOrEqual(3 / FPS - 1e-9);
    expect(plan.probe(B.separation + 1 / FPS).headAttached).toBe(false);
    expect(scale).toBeGreaterThan(0);
  });

  it('launches the head at the sled speed and lands it in the lower branch', () => {
    const plan = build(scenario);
    const { dir, headFlight } = plan.targets;
    const dt = 1 / FPS;
    const sledSpeed =
      Math.abs(
        (plan.probe(B.impact).sled?.corner[0] ?? 0) -
          (plan.probe(B.impact - dt).sled?.corner[0] ?? 0),
      ) / dt;
    const launch = plan.probe(B.separation).head;
    const lodgeAt = contact(plan, SnowmanContactKind.HeadLodge);
    const lodged = plan.probe(lodgeAt).head;
    const headSpeed =
      (dir * (lodged[0] - launch[0])) / (lodgeAt - B.separation);
    expect(headSpeed).toBeGreaterThan(0);
    expect(Math.abs(headSpeed / sledSpeed - 1)).toBeLessThanOrEqual(0.2);
    expect(headFlight.seconds).toBeGreaterThanOrEqual(0.35);
    expect(headFlight.seconds).toBeLessThanOrEqual(0.7);
    expect(Math.abs(lodged[0] - plan.targets.branchX)).toBeLessThan(1);
  });

  it('flexes the branch before the head drops into both mittens', () => {
    const plan = build(scenario);
    const release = contact(plan, SnowmanContactKind.BranchRelease);
    const lodged = plan.probe(release - 0.2).head;
    /* The sneeze bends the bough first, moving the lodged head with it. */
    expect(distance(plan.probe(release).head, lodged)).toBeGreaterThan(0.5);
    const caught = plan.probe(B.catch);
    const between: Point = [
      (caught.gripFront[0] + caught.gripBack[0]) / 2,
      (caught.gripFront[1] + caught.gripBack[1]) / 2,
    ];
    expect(distance(between, caught.head)).toBeLessThanOrEqual(
      1.5 * plan.targets.scale + 2 * plan.targets.scale,
    );
  });

  it('keeps the mittens on the sled and the present while they are held', () => {
    const plan = build(scenario);
    let sledError = 0;
    let presentError = 0;
    for (const t of frames(0, END)) {
      const probe = plan.probe(t);
      if (probe.sledGrips)
        sledError = Math.max(
          sledError,
          distance(probe.gripFront, probe.sledGrips[0]),
          distance(probe.gripBack, probe.sledGrips[1]),
        );
      if (probe.presentGrips)
        presentError = Math.max(
          presentError,
          distance(probe.gripFront, probe.presentGrips[0]),
          distance(probe.gripBack, probe.presentGrips[1]),
        );
    }
    expect(sledError).toBeLessThanOrEqual(1.5);
    expect(presentError).toBeLessThanOrEqual(1.5);
  });

  it('plants each foot until it lifts', () => {
    const plan = build(scenario);
    const { floor, scale } = plan.targets;
    for (const index of [0, 1]) {
      let previous: Point | null = null;
      for (const t of frames(0, END)) {
        const foot = plan.probe(t).feet[index];
        const grounded = Math.abs(foot[1] - floor) < 1e-6;
        if (grounded && previous)
          expect(Math.abs(foot[0] - previous[0])).toBeLessThanOrEqual(
            0.5 * scale + 1e-6,
          );
        previous = grounded ? foot : null;
      }
    }
  });

  it('returns the card copy to its original rect before showing the original', () => {
    const plan = build(scenario);
    if (!plan.targets.card) {
      expect(plan.cardFrames).toEqual([]);
      return;
    }
    const restoreTime = plan.cardRestoreAt * END;
    const settled = plan.cardFrames.filter(
      (frame) =>
        frame.offset * END >= B.slotted - 1e-6 &&
        frame.offset * END <= restoreTime + 1e-6,
    );
    expect(restoreTime - B.slotted).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(settled.length).toBeGreaterThan(0);
    for (const frame of settled) {
      expect(Math.abs(frame.dx)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(frame.dy)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(frame.rotate)).toBeLessThanOrEqual(0.01);
    }
    expect(plan.cardHideAt).toBeCloseTo(B.grip / END, 6);
    expect(plan.cardFrames.length).toBeLessThanOrEqual(48);
  });

  it('walks off past the region edge and clears every decoration by the end', () => {
    const plan = build(scenario);
    const { dir, startEdge } = plan.targets;
    const exit = plan.probe(B.exited);
    expect(dir * (startEdge - exit.seat[0])).toBeGreaterThan(
      SNOWMAN_RIG.baseWidth * plan.targets.scale * 0.5,
    );
    const allLayers = [
      ...plan.animationData.layers,
      ...plan.animationData.assets.flatMap((asset) => asset.layers),
    ];
    expect(allLayers.every((layer) => layer.op <= END * FPS)).toBe(true);
    const scenery = plan.animationData.layers.find(
      (layer) => layer.nm === 'scenery',
    );
    const opacity = scenery?.ks.o.k as { t: number; s: number[] }[];
    expect(opacity[opacity.length - 1]).toMatchObject({ t: END * FPS, s: [0] });
  });

  it('never interpolates a transform through zero scale', () => {
    const plan = build(scenario);
    const crossings: number[][] = [];
    const collect = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(collect);
      else if (node && typeof node === 'object') {
        const record = node as Record<string, unknown>;
        const scale =
          (record.ty === 'tr' ? record.s : undefined) ??
          (record.ks as { s?: unknown } | undefined)?.s;
        const keys = (scale as { a?: number; k?: unknown } | undefined)?.a
          ? (scale as { k: { s: number[]; e?: number[]; h?: number }[] }).k
          : [];
        for (const key of keys)
          if (!key.h && key.e)
            key.s.forEach((value, axis) => {
              const next = key.e?.[axis] ?? value;
              if (Math.sign(value) !== Math.sign(next))
                crossings.push([value, next]);
            });
        Object.values(record).forEach(collect);
      }
    };
    collect(plan.animationData);
    expect(crossings).toEqual([]);
  });

  it('stays within the structural rendering budgets', () => {
    const plan = build(scenario);
    const { layers } = plan.animationData;
    const json = JSON.stringify(plan.animationData);
    expect(json.length).toBeLessThanOrEqual(170_000);
    expect(layers.length).toBeLessThanOrEqual(16);
    const nested = plan.animationData.assets.flatMap((asset) => asset.layers);
    expect(
      [...layers, ...nested].every((layer) => [0, 3, 4].includes(layer.ty)),
    ).toBe(true);
    /* The one precomposition is the snowman, faded in and out as a whole. */
    expect(
      layers.filter((layer) => layer.ty === 0).map((layer) => layer.nm),
    ).toEqual(['snowman']);
    expect(json).not.toMatch(/"(hasMask|tt|ef)":/);
    /* Expressions are strings on an `x` key; easing handles use numeric `x`. */
    expect(json).not.toMatch(/"x":"/);
    expect(json).not.toMatch(/"ty":"(gf|gs)"/);
    let animated = 0;
    let keyframes = 0;
    let longest = 0;
    const walk = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') {
        const record = node as Record<string, unknown>;
        if (record.a === 1 && Array.isArray(record.k)) {
          animated += 1;
          keyframes += record.k.length;
          longest = Math.max(longest, record.k.length);
        }
        Object.values(record).forEach(walk);
      }
    };
    walk(plan.animationData);
    expect(animated).toBeLessThanOrEqual(scenario.isMobile ? 48 : 56);
    expect(longest).toBeLessThanOrEqual(128);
    expect(keyframes).toBeLessThanOrEqual(1300);
    expect(plan.particleCount).toBeLessThanOrEqual(scenario.isMobile ? 4 : 10);
  });
});

describe('snowman delivery budgets', () => {
  it('keeps the static vector artwork small', () => {
    const art = [
      ...bodyArt(),
      ...footArt(),
      ...scarfArt(),
      ...headArt(),
      ...armArt([0, 0]),
      ...presentArt(),
      ...treeArt(),
      ...branchArt(),
      ...needlesArt(),
      ...snowbankArt(),
      ...sledArt(),
      ...puffArt(3),
    ];
    const json = JSON.stringify(art);
    const vertices = (json.match(/\[-?\d+(\.\d+)?,-?\d+(\.\d+)?\]/g) ?? [])
      .length;
    expect(json.length).toBeLessThanOrEqual(48_000);
    expect(vertices).toBeLessThanOrEqual(650);
  });

  it('fits loading, readiness and playback inside the provider lifetime', () => {
    const { loadTimeoutMs, readyTimeoutMs, playbackMs } =
      SNOWMAN_DELIVERY_TIMINGS;
    expect(loadTimeoutMs).toBeLessThanOrEqual(2000);
    expect(readyTimeoutMs).toBeLessThanOrEqual(250);
    expect(loadTimeoutMs + readyTimeoutMs + playbackMs).toBeLessThanOrEqual(
      SNOWMAN_DELIVERY_MS + 2500,
    );
    expect(SNOWMAN_DELIVERY_MS + 2500).toBeLessThanOrEqual(32000);
  });
});

import { describe, expect, it } from 'vitest';
import {
  MAX_CYCLE_REPETITIONS,
  applyElasticRange,
  buildSectionPath,
  buildSplicedPath,
  cycleCount,
  repeatCycle,
  toCompositionFrame,
  toLocalFrame,
  toTimeRemapProperty,
} from '../lottie-time-remap';

const FPS = 60;
const STORY = 25 * FPS;
/* One-prize tail: branches at the first release and resumes at 25 s in the rig. */
const BRANCH = 789;
const TAIL = STORY;

const frames = (ms: number) => (ms / 1000) * FPS;

describe('lottie time remap', () => {
  it('plays a single section unchanged', () => {
    const path = buildSectionPath([{ from: 0, to: STORY }]);

    expect(path).toEqual([
      { from: 0, to: STORY, localFrom: 0, localTo: STORY },
    ]);
    expect(toCompositionFrame(path, 600)).toBe(600);
  });

  it('steps to the one-prize tail at the branch frame', () => {
    const path = buildSectionPath([
      { from: 0, to: BRANCH },
      { from: TAIL, to: TAIL + STORY - BRANCH },
    ]);

    expect(toCompositionFrame(path, BRANCH - 1)).toBe(BRANCH - 1);
    expect(toCompositionFrame(path, TAIL)).toBe(BRANCH);
    expect(toCompositionFrame(path, TAIL + STORY - BRANCH)).toBe(STORY);
    /* The rig frames the step skips never play. */
    expect(toCompositionFrame(path, BRANCH + 1)).toBeUndefined();
    expect(path.at(-1)?.to).toBe(STORY);
  });

  it('plays only the crossing section, from composition frame 0', () => {
    const crossing = { from: 2280, to: 2280 + 9 * FPS };
    const path = buildSectionPath([crossing]);

    expect(path).toEqual([
      { from: 0, to: 540, localFrom: 2280, localTo: 2820 },
    ]);
  });

  it('starts the authored recoil within one frame of a longer physical landing', () => {
    const release = frames(19850);
    const landing = release + frames(350);
    const path = applyElasticRange(buildSectionPath([{ from: 0, to: STORY }]), {
      releaseFrame: release,
      landingFrame: landing,
      elasticFrames: frames(2400),
      physicalFallFrames: frames(530),
    });

    expect(path).toBeDefined();
    const physicalLanding = release + frames(530);
    expect(
      Math.abs(
        (toCompositionFrame(path ?? [], landing) ?? 0) - physicalLanding,
      ),
    ).toBeLessThanOrEqual(1);
    /* The departure keeps its authored composition time. */
    expect(toCompositionFrame(path ?? [], frames(23500))).toBeCloseTo(
      frames(23500),
      6,
    );
    expect(toCompositionFrame(path ?? [], release - 1)).toBe(release - 1);
  });

  it('absorbs a shorter physical fall too', () => {
    const path = applyElasticRange(buildSectionPath([{ from: 0, to: STORY }]), {
      releaseFrame: 600,
      landingFrame: 621,
      elasticFrames: 144,
      physicalFallFrames: 9,
    });

    expect(toCompositionFrame(path ?? [], 621)).toBeCloseTo(609, 6);
    expect(toCompositionFrame(path ?? [], 765)).toBeCloseTo(765, 6);
  });

  it('refuses a fall that would need an elastic speed above 1.25', () => {
    expect(
      applyElasticRange(buildSectionPath([{ from: 0, to: STORY }]), {
        releaseFrame: 600,
        landingFrame: 621,
        elasticFrames: 100,
        physicalFallFrames: 21 + 24,
      }),
    ).toBeUndefined();
  });

  it('refuses a fall that would need an elastic speed below 0.8', () => {
    expect(
      applyElasticRange(buildSectionPath([{ from: 0, to: STORY }]), {
        releaseFrame: 600,
        landingFrame: 650,
        elasticFrames: 100,
        physicalFallFrames: 20,
      }),
    ).toBeUndefined();
  });

  it('re-times a landing inside the one-prize tail in composition frames', () => {
    const path = buildSectionPath([
      { from: 0, to: BRANCH },
      { from: TAIL, to: TAIL + STORY - BRANCH },
    ]);
    const remapped = applyElasticRange(path, {
      releaseFrame: TAIL,
      landingFrame: TAIL + 20,
      elasticFrames: 300,
      physicalFallFrames: 30,
    });

    expect(toCompositionFrame(remapped ?? [], TAIL + 20)).toBeCloseTo(
      BRANCH + 30,
      6,
    );
  });

  it('rejects an elastic window across the branch step', () => {
    const path = buildSectionPath([
      { from: 0, to: BRANCH },
      { from: TAIL, to: TAIL + STORY - BRANCH },
    ]);

    expect(() =>
      applyElasticRange(path, {
        releaseFrame: BRANCH - 20,
        landingFrame: BRANCH - 10,
        elasticFrames: 100,
        physicalFallFrames: 10,
      }),
    ).toThrow('not on the section path');
  });

  it('maps the middle of every piece onto the middle of its composition span', () => {
    const path =
      applyElasticRange(
        buildSectionPath([
          { from: 0, to: BRANCH },
          { from: TAIL, to: TAIL + STORY - BRANCH },
        ]),
        {
          releaseFrame: TAIL,
          landingFrame: TAIL + 20,
          elasticFrames: 300,
          physicalFallFrames: 30,
        },
      ) ?? [];

    expect(path.length).toBeGreaterThan(2);
    for (const { from, to, localFrom, localTo } of path)
      expect(toCompositionFrame(path, (localFrom + localTo) / 2)).toBeCloseTo(
        (from + to) / 2,
        6,
      );
  });

  it('writes the remap in seconds with linear easing and a hold before a step', () => {
    const property = toTimeRemapProperty(
      buildSectionPath([
        { from: 0, to: 600 },
        { from: 1500, to: 1800 },
      ]),
      FPS,
    );

    expect(property.a).toBe(1);
    const keyframes = property.k as {
      t: number;
      s: number[];
      h?: number;
      o?: unknown;
    }[];
    expect(keyframes.map(({ t }) => t)).toEqual([0, 599.999, 600, 900]);
    expect(keyframes[0]).toMatchObject({ s: [0], o: { x: [0], y: [0] } });
    expect(keyframes[1].h).toBe(1);
    expect(keyframes[1].s[0]).toBeCloseTo(599.999 / FPS, 9);
    expect(keyframes[2].s).toEqual([1500 / FPS]);
    expect(keyframes[3].s).toEqual([1800 / FPS]);
  });
});

describe('spliced paths and step cycles', () => {
  const trunk = { from: 0, to: 1500 };
  const pickup = {
    cut: { from: 240, to: 354 },
    fill: { from: 1600, to: 1714 },
  };
  const carry = {
    cut: { from: 1260, to: 1392 },
    fill: { from: 1800, to: 1932 },
  };

  it('keeps every trunk frame after a splice on its composition frame', () => {
    const path = buildSplicedPath(trunk, [carry, pickup]);

    expect(toCompositionFrame(path, 720)).toBeCloseTo(720, 9);
    expect(toCompositionFrame(path, 1450)).toBeCloseTo(1450, 9);
    expect(toCompositionFrame(path, 1650)).toBeCloseTo(290, 9);
    expect(path.at(-1)?.to).toBe(1500);
  });

  it('rejects a fill that does not last as long as its cut', () => {
    expect(() =>
      buildSplicedPath(trunk, [
        { cut: pickup.cut, fill: { from: 1600, to: 1700 } },
      ]),
    ).toThrow('does not last as long as its cut');
  });

  it('rejects overlapping cuts', () => {
    expect(() =>
      buildSplicedPath(trunk, [
        pickup,
        { cut: { from: 300, to: 400 }, fill: { from: 1800, to: 1900 } },
      ]),
    ).toThrow('overlaps');
  });

  it('plays a cycle k times inside its window, filling the window exactly', () => {
    const path = repeatCycle(buildSectionPath([trunk]), {
      cycle: { from: 1311, to: 1325 },
      from: 1311,
      to: 1353,
      count: 3,
    });
    const plays = path.filter(({ localFrom }) => localFrom === 1311);

    expect(plays.map(({ from, to }) => [from, to])).toEqual([
      [1311, 1325],
      [1325, 1339],
      [1339, 1353],
    ]);
    expect(toCompositionFrame(path, 1400)).toBeCloseTo(1400, 9);
  });

  it('maps a composition frame back to the local frame it shows, through splices', () => {
    const path = buildSplicedPath({ from: 0, to: 100 }, [
      { cut: { from: 20, to: 30 }, fill: { from: 200, to: 210 } },
    ]);

    expect(toLocalFrame(path, 10)).toBeCloseTo(10, 9);
    expect(toLocalFrame(path, 25)).toBeCloseTo(205, 9);
    expect(toLocalFrame(path, 30)).toBeCloseTo(30, 9);
    expect(toLocalFrame(path, 100)).toBeCloseTo(100, 9);
    expect(toLocalFrame(path, 120)).toBeUndefined();
  });

  it('speeds the cycle up to fit more plays in the same window', () => {
    const path = repeatCycle(buildSectionPath([trunk]), {
      cycle: { from: 1311, to: 1325 },
      from: 1311,
      to: 1353,
      count: 6,
    });

    expect(
      path
        .filter(({ localFrom }) => localFrom === 1311)
        .every(({ from, to }) => Math.abs(to - from - 7) < 1e-9),
    ).toBe(true);
  });

  it('writes a hold before every repetition so the cycle steps back cleanly', () => {
    const path = repeatCycle(buildSectionPath([trunk]), {
      cycle: { from: 1311, to: 1325 },
      from: 1311,
      to: 1353,
      count: 3,
    });
    const keyframes = toTimeRemapProperty(path, 60).k as { h?: number }[];

    expect(keyframes.filter(({ h }) => h === 1)).toHaveLength(3);
  });

  it('rounds the cycle count to the distance and caps it', () => {
    expect(cycleCount(460, 30.6)).toBe(15);
    expect(cycleCount(10, 30.6)).toBe(1);
    expect(cycleCount(5000, 30.6)).toBe(MAX_CYCLE_REPETITIONS);
  });

  it('rejects a cycle window across a splice step', () => {
    const path = buildSplicedPath(trunk, [pickup]);

    expect(() =>
      repeatCycle(path, {
        cycle: { from: 300, to: 310 },
        from: 230,
        to: 260,
        count: 2,
      }),
    ).toThrow('crosses a step');
  });

  it('rejects a count outside 1–24', () => {
    expect(() =>
      repeatCycle(buildSectionPath([trunk]), {
        cycle: { from: 0, to: 10 },
        from: 0,
        to: 30,
        count: 25,
      }),
    ).toThrow('outside 1–24');
  });
});

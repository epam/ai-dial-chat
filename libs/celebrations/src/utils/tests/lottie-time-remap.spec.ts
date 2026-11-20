import { describe, expect, it } from 'vitest';
import {
  applyElasticRange,
  buildSectionPath,
  toCompositionFrame,
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

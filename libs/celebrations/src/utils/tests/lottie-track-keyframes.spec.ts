import { describe, expect, it } from 'vitest';
import type { LottieLayer } from '../../models/lottie-composition';
import type { CopyTrackOptions } from '../../models/lottie-track-keyframes';
import { buildSectionPath, repeatCycle } from '../lottie-time-remap';
import {
  COPY_MAX_TILT_DEG,
  appendCopyFall,
  copyFallMs,
  copyPathKeyframes,
  copyTrackKeyframes,
  copyTravelKeyframes,
} from '../lottie-track-keyframes';

const EASE = { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } };
const LINEAR = { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } };
const DURATION = 25000;
const FPS = 60;

/* Fades in at frame 590, nudges 5 units by 640, pushes to 22 units by 700. */
const prizeTrack = (): LottieLayer => ({
  ty: 3,
  nm: 'prize-0',
  ks: {
    p: {
      a: 1,
      k: [
        { t: 590, s: [140, 120, 0], ...LINEAR },
        { t: 600, s: [140, 120, 0], ...EASE },
        { t: 640, s: [145, 120, 0], h: 1 },
        { t: 660, s: [145, 120, 0], ...EASE },
        { t: 700, s: [162, 120, 0] },
      ],
    },
    r: {
      a: 1,
      k: [
        { t: 590, s: [0], ...LINEAR },
        { t: 600, s: [0], ...EASE },
        { t: 640, s: [0], h: 1 },
        { t: 660, s: [0], ...EASE },
        { t: 700, s: [3] },
      ],
    },
    o: {
      a: 1,
      k: [
        { t: 590, s: [0], ...LINEAR },
        { t: 600, s: [100], ...EASE },
        { t: 640, s: [100], h: 1 },
        { t: 660, s: [100], ...EASE },
        { t: 700, s: [100] },
      ],
    },
  },
});

const options = (
  overrides: Partial<CopyTrackOptions> = {},
): CopyTrackOptions => ({
  durationMs: DURATION,
  toCompositionMs: (frame) => (frame / FPS) * 1000,
  releaseFrame: 700,
  mirror: 1,
  scale: 1,
  ...overrides,
});

const transformOf = (keyframe: Keyframe) => String(keyframe.transform);

describe('copyTrackKeyframes', () => {
  it('converts the authored track into WAAPI keyframes on the composition clock', () => {
    const { keyframes, releaseX } = copyTrackKeyframes(prizeTrack(), options());

    const offsets = [0, 590, 600, 640, 660, 700].map((frame) => frame / 1500);
    keyframes.forEach(({ offset }, index) =>
      expect(offset).toBeCloseTo(offsets[index], 9),
    );
    expect(keyframes[2]).toMatchObject({
      opacity: 1,
      transform: 'translate(0px, 0px) rotate(0deg)',
      easing: 'cubic-bezier(0.42, 0, 0.58, 1)',
    });
    expect(keyframes[1]).toMatchObject({ opacity: 0, easing: 'linear' });
    expect(keyframes[3].easing).toBe('steps(1, end)');
    expect(transformOf(keyframes[5])).toBe('translate(22px, 0px) rotate(3deg)');
    expect(releaseX).toBe(22);
  });

  it('mirrors the horizontal push and rotation and applies the stage scale', () => {
    const { keyframes, releaseX } = copyTrackKeyframes(
      prizeTrack(),
      options({ mirror: -1, scale: 0.8 }),
    );

    expect(transformOf(keyframes[5])).toBe(
      'translate(-17.6px, 0px) rotate(-3deg)',
    );
    expect(releaseX).toBeCloseTo(-17.6, 6);
  });

  it('maps local frames through the given clock', () => {
    const { keyframes } = copyTrackKeyframes(
      prizeTrack(),
      options({ toCompositionMs: (frame) => ((frame - 100) / FPS) * 1000 }),
    );

    expect(keyframes[1].offset).toBeCloseTo(490 / 1500, 9);
  });

  it('rejects a track that animates its scale', () => {
    const layer = prizeTrack();
    layer.ks = { ...layer.ks, s: { a: 1, k: [] } };

    expect(() => copyTrackKeyframes(layer, options())).toThrow(
      'animates its scale',
    );
  });

  it('rejects tracks that do not share keyframe times', () => {
    const layer = prizeTrack();
    (layer.ks?.r?.k as { t: number }[])[1].t = 605;

    expect(() => copyTrackKeyframes(layer, options())).toThrow(
      'do not share keyframe times and easing',
    );
  });

  it('rejects tracks that do not share easing', () => {
    const layer = prizeTrack();
    Object.assign((layer.ks?.o?.k as object[])[1], LINEAR);

    expect(() => copyTrackKeyframes(layer, options())).toThrow(
      'do not share keyframe times and easing',
    );
  });

  it('ignores keyframes before the story and rests on its first keyframe', () => {
    const { keyframes, releaseX } = copyTrackKeyframes(
      prizeTrack(),
      options({ fromFrame: 640 }),
    );

    expect(keyframes.map(({ offset }) => offset)).toHaveLength(4);
    expect(transformOf(keyframes[1])).toBe('translate(0px, 0px) rotate(0deg)');
    expect(releaseX).toBe(17);
  });

  it('rejects a track without a keyframe at the release', () => {
    expect(() =>
      copyTrackKeyframes(prizeTrack(), options({ releaseFrame: 690 })),
    ).toThrow('no keyframe at the release');
  });
});

describe('appendCopyFall', () => {
  const track = () => copyTrackKeyframes(prizeTrack(), options());
  const fall = {
    durationMs: DURATION,
    releaseMs: (700 / FPS) * 1000,
    dropPx: 160,
    widthPx: 36,
    side: 1 as const,
    restoreMs: 23000,
  };
  const yOf = (keyframe: Keyframe) =>
    Number(/translate\([^,]+, (-?[\d.]+)px/.exec(transformOf(keyframe))?.[1]);
  const rotationOf = (keyframe: Keyframe) =>
    Number(/rotate\((-?[\d.]+)deg/.exec(transformOf(keyframe))?.[1]);

  it('lands after the gravity fall time, accelerating', () => {
    const keyframes = appendCopyFall(track(), fall).slice(6);
    const landing = keyframes[17];

    expect(copyFallMs(160)).toBe(400);
    expect(landing.offset).toBeCloseTo((fall.releaseMs + 400) / DURATION, 9);
    expect(yOf(landing)).toBe(160);
    expect(yOf(keyframes[8]) - yOf(keyframes[7])).toBeLessThan(
      yOf(keyframes[17]) - yOf(keyframes[16]),
    );
  });

  it('keeps the tilt within its bound and the copy at its pushed position', () => {
    const keyframes = appendCopyFall(track(), fall).slice(6);

    for (const keyframe of keyframes) {
      expect(Math.abs(rotationOf(keyframe))).toBeLessThanOrEqual(
        COPY_MAX_TILT_DEG,
      );
      expect(transformOf(keyframe)).toMatch(/^translate\(22px, /);
    }
  });

  it('rebounds to the given height before resting on the support', () => {
    const keyframes = appendCopyFall(track(), {
      ...fall,
      reboundHeightPx: 40,
    }).slice(6 + 18);

    expect(Math.min(...keyframes.slice(0, 20).map(yOf))).toBeCloseTo(120, 3);
    expect(yOf(keyframes[19])).toBe(160);
    expect(rotationOf(keyframes[9])).toBeLessThan(0);
  });

  it('only translates, rotates and fades the copy', () => {
    const keyframes = appendCopyFall(track(), { ...fall, reboundHeightPx: 40 });

    for (const keyframe of keyframes)
      expect(transformOf(keyframe)).toMatch(
        /^translate\(-?[\d.]+px, -?[\d.]+px\) rotate\(-?[\d.]+deg\)$/,
      );
  });

  it('fades the copy out from the restore time', () => {
    const keyframes = appendCopyFall(track(), fall);
    const restore = keyframes.findIndex(
      ({ offset }) => offset === 23000 / DURATION,
    );

    expect(keyframes[restore]).toMatchObject({
      opacity: 1,
      easing: 'ease-in-out',
    });
    expect(keyframes[restore + 1]).toMatchObject({ offset: 0.96, opacity: 0 });
    expect(keyframes.at(-1)).toMatchObject({ offset: 1, opacity: 0 });
  });

  it('rejects a copy still moving at the restore time', () => {
    expect(() =>
      appendCopyFall(track(), { ...fall, restoreMs: fall.releaseMs + 100 }),
    ).toThrow('still moving at the restore');
  });
});

describe('copyPathKeyframes', () => {
  const OUT = { x: [0.33], y: [0] };
  const IN = { x: [0.67], y: [1] };
  /* The card sits on its slot (100, 50), rides off and comes back. */
  const card = (): LottieLayer => ({
    ty: 3,
    nm: 'ct-track:copy',
    ks: {
      p: {
        a: 1,
        k: [
          { t: 0, s: [100, 50, 0], h: 1 },
          { t: 60, s: [100, 50, 0], o: OUT, i: IN },
          { t: 120, s: [300, 20, 0], o: OUT, i: IN },
          { t: 130, s: [310, 20, 0], o: OUT, i: IN },
          { t: 140, s: [300, 20, 0], o: OUT, i: IN },
          { t: 180, s: [100, 50, 0] },
        ],
      },
      r: {
        a: 1,
        k: [
          { t: 0, s: [0], h: 1 },
          { t: 60, s: [0], o: OUT, i: IN },
          { t: 120, s: [-14], o: OUT, i: IN },
          { t: 130, s: [-10], o: OUT, i: IN },
          { t: 140, s: [-14], o: OUT, i: IN },
          { t: 180, s: [0] },
        ],
      },
      o: {
        a: 1,
        k: [
          { t: 0, s: [0], h: 1 },
          { t: 60, s: [100], o: OUT, i: IN },
          { t: 120, s: [100], o: OUT, i: IN },
          { t: 130, s: [100], o: OUT, i: IN },
          { t: 140, s: [100], o: OUT, i: IN },
          { t: 180, s: [100] },
        ],
      },
    },
  });
  const options = {
    durationMs: 3000,
    frameRate: 60,
    segments: buildSectionPath([{ from: 0, to: 180 }]),
    origin: { x: 100, y: 50 },
    scale: 0.5,
  };

  it('carries x and y as a translation from the origin, with rotation and opacity', () => {
    const keyframes = copyPathKeyframes(card(), options);

    expect(keyframes[2]).toEqual({
      offset: 2 / 3,
      opacity: 1,
      transform: 'translate(100px, -15px) rotate(-14deg)',
      easing: 'cubic-bezier(0.33, 0, 0.67, 1)',
    });
    expect(keyframes[0].easing).toBe('steps(1, end)');
  });

  it('emits a cycle keyframe once per repetition, at its composition time', () => {
    const segments = repeatCycle(buildSectionPath([{ from: 0, to: 180 }]), {
      cycle: { from: 120, to: 140 },
      from: 120,
      to: 180,
      count: 4,
    });
    const keyframes = copyPathKeyframes(card(), { ...options, segments });
    const offsets = keyframes.map(({ offset }) => offset as number);

    expect(
      keyframes.filter(({ transform }) =>
        String(transform).startsWith('translate(105px'),
      ),
    ).toHaveLength(4);
    expect(
      offsets.every(
        (offset, index) => index === 0 || offset >= offsets[index - 1],
      ),
    ).toBe(true);
  });

  it('rejects a step that lands between keyframes', () => {
    const segments = repeatCycle(buildSectionPath([{ from: 0, to: 180 }]), {
      cycle: { from: 125, to: 140 },
      from: 120,
      to: 160,
      count: 2,
    });

    expect(() => copyPathKeyframes(card(), { ...options, segments })).toThrow(
      'no keyframe at local frame 125',
    );
  });
});

describe('copyTravelKeyframes', () => {
  it('translates the carrying layer from the origin with the authored easing', () => {
    const travel: LottieLayer = {
      ty: 3,
      nm: 'ct-travel',
      ks: {
        p: {
          a: 1,
          k: [
            { t: 0, s: [0, 0, 0], h: 1 },
            {
              t: 1311,
              s: [0, 0, 0],
              o: { x: [0], y: [0] },
              i: { x: [1], y: [1] },
            },
            { t: 1353, s: [-400, 0, 0] },
          ],
        },
      },
    };

    const keyframes = copyTravelKeyframes(travel, {
      durationMs: 25000,
      frameRate: 60,
      origin: { x: 0, y: 0 },
      scale: 0.9,
    });

    /* The last key holds to offset 1, so WAAPI never falls back to the underlying value. */
    expect(keyframes.map(({ transform }) => transform)).toEqual([
      'translate(0px, 0px)',
      'translate(0px, 0px)',
      'translate(-360px, 0px)',
      'translate(-360px, 0px)',
    ]);
    expect(keyframes.at(-1)?.offset).toBe(1);
    expect(keyframes.map(({ easing }) => easing)).toEqual([
      'steps(1, end)',
      'linear',
      'linear',
      'linear',
    ]);
    expect(keyframes[1].offset).toBeCloseTo(0.874, 9);
    expect(keyframes[2].offset).toBeCloseTo(0.902, 9);
  });
});

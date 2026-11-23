import { describe, expect, it } from 'vitest';
import type {
  LottieStationBinding,
  LottieTrackBinding,
} from '../../models/lottie-anchor-binding';
import type { LottieLayer } from '../../models/lottie-composition';
import {
  bindStationKeyframes,
  bindTrackLayers,
} from '../lottie-anchor-binding';

const EASE = { o: { x: [0.33], y: [0] }, i: { x: [0.67], y: [1] } };

const nullLayer = (nm: string, ks: LottieLayer['ks']): LottieLayer => ({
  ty: 3,
  nm,
  ks,
});

/* Authored at reference geometry: perch at (100, 50), prize-0 edge at (140, 120). */
const authoredLayers = (): LottieLayer[] => [
  nullLayer('anchor:perch', { p: { a: 0, k: [100, 50, 0] } }),
  nullLayer('anchor:prize-0', { p: { a: 0, k: [140, 120, 0] } }),
  nullLayer('cat-root', {
    p: {
      a: 1,
      k: [
        { t: 0, s: [70, 90, 0], ...EASE },
        { t: 30, s: [100, 50, 0], ...EASE },
        { t: 60, s: [110, 120, 0], ...EASE },
        { t: 90, s: [115, 120, 0] },
      ],
    },
  }),
  nullLayer('cat-facing', {
    s: {
      a: 1,
      k: [
        { t: 0, s: [100, 100, 100], h: 1 },
        { t: 90, s: [100, 100, 100] },
      ],
    },
  }),
  { ty: 4, nm: 'tail', shapes: [] },
];

const binding = (
  overrides: Partial<LottieStationBinding> = {},
): LottieStationBinding => ({
  positionLayer: 'cat-root',
  facingLayer: 'cat-facing',
  referencePrefix: 'anchor:',
  bindings: [
    { kind: 'bind', argument: 'perch', frame: 0, duration: 60 },
    { kind: 'bind', argument: 'prize-0', frame: 60, duration: 30 },
  ],
  anchors: {
    perch: { point: { x: 400, y: 300 }, side: 1 },
    'prize-0': { point: { x: 450, y: 380 }, side: 1 },
  },
  ...overrides,
});

const keyframes = (layers: LottieLayer[], name: string, key: 'p' | 's') =>
  (
    layers.find((layer) => layer.nm === name)?.ks?.[key]?.k as {
      t: number;
      s: number[];
    }[]
  ).map(({ t, s }) => ({ t, s }));

describe('bindStationKeyframes', () => {
  it('moves each station keyframe onto its measured anchor, keeping its authored offset', () => {
    const layers = bindStationKeyframes(authoredLayers(), binding());

    expect(keyframes(layers, 'cat-root', 'p')).toEqual([
      { t: 0, s: [370, 340, 0] },
      { t: 30, s: [400, 300, 0] },
      { t: 60, s: [420, 380, 0] },
      { t: 90, s: [425, 380, 0] },
    ]);
  });

  it('mirrors the offsets and the facing when the measured side differs', () => {
    const layers = bindStationKeyframes(
      authoredLayers(),
      binding({
        anchors: {
          perch: { point: { x: 400, y: 300 }, side: 1 },
          'prize-0': { point: { x: 450, y: 380 }, side: -1 },
        },
      }),
    );

    expect(keyframes(layers, 'cat-root', 'p').slice(2)).toEqual([
      { t: 60, s: [480, 380, 0] },
      { t: 90, s: [475, 380, 0] },
    ]);
    expect(keyframes(layers, 'cat-facing', 's')).toEqual([
      { t: 0, s: [100, 100, 100] },
      { t: 90, s: [-100, 100, 100] },
    ]);
  });

  it('keeps keyframe times, counts and easing', () => {
    const input = authoredLayers();
    const layers = bindStationKeyframes(input, binding());
    const strip = (layer: LottieLayer | undefined) =>
      (layer?.ks?.p?.k as { s: number[] }[]).map(({ s: _s, ...rest }) => rest);

    expect(strip(layers.find(({ nm }) => nm === 'cat-root'))).toEqual(
      strip(input.find(({ nm }) => nm === 'cat-root')),
    );
  });

  it('leaves the input and every other layer untouched', () => {
    const input = authoredLayers();
    const before = structuredClone(input);
    const layers = bindStationKeyframes(input, binding());

    expect(input).toEqual(before);
    expect(layers[4]).toBe(input[4]);
    expect(layers[0]).toBe(input[0]);
  });

  it('assigns a keyframe on a shared boundary to the later range', () => {
    const layers = bindStationKeyframes(
      authoredLayers(),
      binding({
        anchors: {
          perch: { point: { x: 400, y: 300 }, side: 1 },
          'prize-0': { point: { x: 0, y: 0 }, side: 1 },
        },
      }),
    );

    expect(keyframes(layers, 'cat-root', 'p')[2]).toEqual({
      t: 60,
      s: [-30, 0, 0],
    });
  });

  it.each([
    [
      'an unbound keyframe',
      binding({
        bindings: [{ kind: 'bind', argument: 'perch', frame: 0, duration: 40 }],
      }),
      'unbound keyframe at frame 60',
    ],
  ])('rejects %s', (_case, options, message) => {
    expect(() => bindStationKeyframes(authoredLayers(), options)).toThrow(
      message,
    );
  });

  it('leaves the keyframes of an unmeasured anchor as authored', () => {
    const input = authoredLayers();
    const layers = bindStationKeyframes(
      input,
      binding({ anchors: { perch: { point: { x: 400, y: 300 }, side: 1 } } }),
    );

    expect(keyframes(layers, 'cat-root', 'p').slice(2)).toEqual(
      keyframes(input, 'cat-root', 'p').slice(2),
    );
    expect(keyframes(layers, 'cat-root', 'p')[1]).toEqual({
      t: 30,
      s: [400, 300, 0],
    });
  });

  it('rejects a station layer with spatial tangents', () => {
    const layers = authoredLayers();
    (layers[2].ks?.p?.k as Record<string, unknown>[])[1].to = [5, 0, 0];

    expect(() => bindStationKeyframes(layers, binding())).toThrow(
      'spatial tangents',
    );
  });

  it('rejects a facing layer that does not hold', () => {
    const layers = authoredLayers();
    delete (layers[3].ks?.s?.k as Record<string, unknown>[])[0].h;

    expect(() => bindStationKeyframes(layers, binding())).toThrow(
      'does not hold',
    );
  });

  it('rejects a reference null with an animated position', () => {
    const layers = authoredLayers();
    layers[0] = nullLayer('anchor:perch', {
      p: { a: 1, k: [{ t: 0, s: [100, 50, 0] }] },
    });

    expect(() => bindStationKeyframes(layers, binding())).toThrow(
      'no static position',
    );
  });

  it('accepts a facing null parented to the station null', () => {
    const layers = authoredLayers();
    layers[2] = { ...layers[2], ind: 1 };
    layers[3] = { ...layers[3], parent: 1 };

    expect(() => bindStationKeyframes(layers, binding())).not.toThrow();
  });

  it('rejects a station layer with a parent', () => {
    const layers = authoredLayers();
    layers[2] = { ...layers[2], parent: 9 };

    expect(() => bindStationKeyframes(layers, binding())).toThrow(
      '"cat-root" has a parent',
    );
  });

  it('rejects a duplicated or missing station layer', () => {
    const duplicated = [...authoredLayers(), nullLayer('cat-root', {})];
    const missing = authoredLayers().filter(({ nm }) => nm !== 'cat-facing');

    expect(() => bindStationKeyframes(duplicated, binding())).toThrow(
      'found 2',
    );
    expect(() => bindStationKeyframes(missing, binding())).toThrow('found 0');
  });

  it('rejects keyframes in the legacy start-and-end format', () => {
    const layers = authoredLayers();
    (layers[2].ks?.p?.k as Record<string, unknown>[])[0].e = [100, 50, 0];

    expect(() => bindStationKeyframes(layers, binding())).toThrow(
      'without a start value',
    );
  });
});

/* A sled rides from the seat (x 100) to the impact (x 400); the snowbank waits
   at the impact and the tree further on. */
const travelLayers = (): LottieLayer[] => [
  nullLayer('anchor:span-start', { p: { a: 0, k: [100, 0, 0] } }),
  nullLayer('anchor:span-end', { p: { a: 0, k: [400, 0, 0] } }),
  nullLayer('ct-track:sled', {
    p: {
      a: 1,
      k: [
        { t: 0, s: [100, 0, 0], ...EASE },
        { t: 10, s: [112, 0, 0], ...EASE },
        { t: 20, s: [130, 0, 0], ...EASE },
        { t: 30, s: [400, 0, 0], ...EASE },
        { t: 40, s: [400, 0, 0] },
      ],
    },
    r: {
      a: 1,
      k: [
        { t: 0, s: [0] },
        { t: 30, s: [-14] },
      ],
    },
  }),
  nullLayer('ct-follow:span-end', { p: { a: 0, k: [409, 0, 0] } }),
  { ty: 4, nm: 'snowbank', parent: 4, shapes: [] },
];

const travel = (
  overrides: Partial<LottieTrackBinding> = {},
): LottieTrackBinding => ({
  trackLayers: ['ct-track:sled'],
  referencePrefix: 'anchor:',
  followPrefix: 'ct-follow:',
  bindings: [
    { kind: 'bind', argument: 'span-start', frame: 0, duration: 5 },
    { kind: 'bind', argument: 'span-end', frame: 30, duration: 11 },
  ],
  stretches: [{ kind: 'stretch', frame: 5, duration: 25 }],
  anchors: {
    'span-start': { point: { x: 1000, y: 500 }, side: 1 },
    'span-end': { point: { x: 1150, y: 500 }, side: 1 },
  },
  ...overrides,
});

describe('bindTrackLayers', () => {
  it('keeps each stretched key at its authored share of the span', () => {
    const layers = bindTrackLayers(travelLayers(), travel());

    expect(
      keyframes(layers, 'ct-track:sled', 'p').map(({ s }) => s[0]),
    ).toEqual([1000, 1006, 1015, 1150, 1150]);
  });

  it('moves an offset track in proportion to its own progress, and holds a still track with the bind before until the next bind', () => {
    const layers = [
      ...travelLayers(),
      nullLayer('ct-track:corner', {
        p: {
          a: 1,
          k: [
            { t: 0, s: [-16, 0, 0] },
            { t: 10, s: [-4, 0, 0] },
            { t: 20, s: [14, 0, 0] },
            { t: 30, s: [284, 0, 0] },
          ],
        },
      }),
      nullLayer('ct-track:body', {
        p: {
          a: 1,
          k: [
            { t: 0, s: [100, 0, 0] },
            { t: 20, s: [100, 0, 0] },
            { t: 30, s: [100, 0, 0] },
          ],
        },
      }),
    ];
    const bound = bindTrackLayers(
      layers,
      travel({
        trackLayers: ['ct-track:sled', 'ct-track:corner', 'ct-track:body'],
      }),
    );

    expect(
      keyframes(bound, 'ct-track:corner', 'p').map(({ s }) => s[0]),
    ).toEqual([884, 890, 899, 1034]);
    expect(keyframes(bound, 'ct-track:body', 'p').map(({ s }) => s[0])).toEqual(
      [1000, 1000, 850],
    );
  });

  it('keeps a resting track where it was put when the scene moves on to another anchor', () => {
    const layers = [
      ...travelLayers(),
      nullLayer('ct-track:card', {
        p: {
          a: 1,
          k: [
            { t: 0, s: [100, 0, 0] },
            { t: 30, s: [380, 0, 0] },
            { t: 35, s: [380, 0, 0] },
            { t: 40, s: [380, 0, 0] },
          ],
        },
      }),
    ];
    const options = travel({
      trackLayers: ['ct-track:sled', 'ct-track:card'],
      bindings: [
        { kind: 'bind', argument: 'span-start', frame: 0, duration: 5 },
        { kind: 'bind', argument: 'span-end', frame: 30, duration: 5 },
        { kind: 'bind', argument: 'span-start', frame: 35, duration: 6 },
      ],
    });

    expect(
      keyframes(
        bindTrackLayers(layers, { ...options, holdsRest: true }),
        'ct-track:card',
        'p',
      ).map(({ s }) => s[0]),
    ).toEqual([1000, 1130, 1130, 1130]);
    expect(
      keyframes(bindTrackLayers(layers, options), 'ct-track:card', 'p').map(
        ({ s }) => s[0],
      ),
    ).toEqual([1000, 1130, 1280, 1280]);
  });

  it('moves a follow group rigidly with its anchor and leaves its children alone', () => {
    const input = travelLayers();
    const layers = bindTrackLayers(input, travel());

    expect(layers[3].ks?.p?.k).toEqual([1159, 500, 0]);
    expect(layers[4]).toBe(input[4]);
  });

  it('mirrors stretched keys and follow groups when the measured side is −1', () => {
    const layers = bindTrackLayers(
      travelLayers(),
      travel({
        anchors: {
          'span-start': { point: { x: 1000, y: 500 }, side: -1 },
          'span-end': { point: { x: 850, y: 500 }, side: -1 },
        },
      }),
    );

    expect(
      keyframes(layers, 'ct-track:sled', 'p').map(({ s }) => s[0]),
    ).toEqual([1000, 994, 985, 850, 850]);
    expect(layers[3].ks?.p?.k).toEqual([841, 500, 0]);
    expect(layers[3].ks?.s?.k).toEqual([-100, 100, 100]);
  });

  it('holds a stretched key with the bind before when both anchors share an x', () => {
    const layers = bindTrackLayers(
      travelLayers(),
      travel({
        anchors: {
          'span-start': { point: { x: 700, y: 500 }, side: 1 },
          'span-end': { point: { x: 700, y: 500 }, side: 1 },
        },
      }),
    );

    expect(
      keyframes(layers, 'ct-track:sled', 'p').every(({ s }) =>
        s.every(Number.isFinite),
      ),
    ).toBe(true);
  });

  it('rejects a facing layer that is also a track', () => {
    expect(() =>
      bindTrackLayers(
        travelLayers(),
        travel({ facingLayer: 'ct-track:sled' } as never),
      ),
    ).toThrow('is both a track and the facing');
  });

  it('keeps keyframe times, counts and easing on every track', () => {
    const input = travelLayers();
    const layers = bindTrackLayers(input, travel());
    const strip = (layer: LottieLayer) =>
      (layer.ks?.p?.k as { s: number[] }[]).map(({ s: _s, ...rest }) => rest);

    expect(strip(layers[2])).toEqual(strip(input[2]));
  });

  it('leaves the input untouched', () => {
    const input = travelLayers();
    const before = structuredClone(input);
    bindTrackLayers(input, travel());

    expect(input).toEqual(before);
  });

  it.each([
    [
      'a stretch that is not between two binds',
      travel({ stretches: [{ kind: 'stretch', frame: 6, duration: 24 }] }),
      'is not between two binds',
    ],
    [
      'a stretch whose neighbours face different sides',
      travel({
        anchors: {
          'span-start': { point: { x: 1000, y: 500 }, side: 1 },
          'span-end': { point: { x: 850, y: 500 }, side: -1 },
        },
      }),
      'changes side',
    ],
    [
      'an unbound track keyframe',
      travel({ stretches: [] }),
      'unbound keyframe at frame 10',
    ],
  ])('rejects %s', (_case, options, message) => {
    expect(() => bindTrackLayers(travelLayers(), options)).toThrow(message);
  });

  it('rejects a follow group that is not a null', () => {
    const layers = travelLayers();
    layers[3] = { ...layers[3], ty: 4 };

    expect(() => bindTrackLayers(layers, travel())).toThrow('is not a null');
  });
});

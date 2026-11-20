import { describe, expect, it } from 'vitest';
import type { LottieStationBinding } from '../../models/lottie-anchor-binding';
import type { LottieLayer } from '../../models/lottie-composition';
import { bindStationKeyframes } from '../lottie-anchor-binding';

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

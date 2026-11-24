import type {
  LottieComposition,
  LottieLayer,
} from '../models/lottie-composition';
import { HistoryLadderAnchor } from '../types/history-ladder';

const at = (k: unknown) => ({ a: 0, k });
const key = (t: number, s: number[]) => ({
  t,
  s,
  o: { x: [0.33], y: [0.33] },
  i: { x: [0.67], y: [0.67] },
});
const transform = (x = 0, y = 0, opacity = 100) => ({
  p: at([x, y, 0]),
  a: at([0, 0, 0]),
  s: at([100, 100, 100]),
  r: at(0),
  o: at(opacity),
});
const shape = (x: number, y: number, width: number, height: number) => ({
  ty: 'rc',
  p: at([x, y]),
  s: at([width, height]),
  r: at(0),
});

/** A small generic inline asset for contract and mapping tests; no scene artwork. */
export const historyLadderFixture = (
  copyAnchor = HistoryLadderAnchor.Row2,
): LottieComposition & { fr: number } => {
  const anchors = Object.values(HistoryLadderAnchor);
  const references = anchors.map((_, index) => [260, 100 + index * 40, 0]);
  const source = references[anchors.indexOf(copyAnchor)];
  const times = [0, 6, 12, 24, 25.2, 30];
  const copyKey = (t: number, value: number[]) => ({
    ...key(t, value),
    ...(t === 0 ? { h: 1 } : {}),
  });
  const positions = times.map((t) =>
    copyKey(t, t === 12 ? [source[0] + 20, source[1] + 40, 0] : [...source]),
  );
  const layers: LottieLayer[] = [
    ...anchors.map((name, index) => ({
      ty: 3,
      ind: index + 1,
      nm: `hl-anchor:${name}`,
      ks: transform(references[index][0], references[index][1]),
    })),
    ...anchors.map((name, index) => ({
      ty: 4,
      ind: index + 7,
      nm: `hl-bounds:${name}`,
      ks: transform(0, 0, 0),
      shapes: [shape(references[index][0], references[index][1] - 20, 100, 60)],
    })),
    {
      ty: 4,
      ind: 13,
      nm: 'hl-range',
      ks: transform(0, 0, 0),
      shapes: [shape(0, 0, 24, 80)],
    },
    {
      ty: 3,
      ind: 14,
      nm: 'hl-track:actor',
      ks: {
        ...transform(),
        p: {
          a: 1,
          k: [0, 6, 12, 18, 24, 27, 30].map((t, index) =>
            key(t, [...references[Math.min(index, 5)]]),
          ),
        },
      },
    },
    {
      ty: 3,
      ind: 15,
      nm: 'hl-track:copy',
      ks: {
        ...transform(),
        p: { a: 1, k: positions },
        r: { a: 1, k: times.map((t) => copyKey(t, [t === 12 ? 12 : 0])) },
        o: {
          a: 1,
          k: times.map((t) => copyKey(t, [t > 0 && t <= 24 ? 100 : 0])),
        },
      },
    },
    ...['history', 'drawn'].map((mode, index) => ({
      ty: 4,
      ind: 16 + index,
      nm: `hl-if:${mode}`,
      parent: 14,
      ks: transform(),
      shapes: [
        shape(0, 0, 10, 10),
        { ty: 'fl', c: at([0.2, 0.3, 0.5, 1]), o: at(100) },
      ],
    })),
  ];
  return {
    v: '5.13.0',
    w: 640,
    h: 640,
    fr: 30,
    ip: 0,
    op: 30,
    layers,
    markers: [
      ...anchors.map((name, index) => ({
        cm: `hl:actor:${name}`,
        tm: [0, 6, 12, 18, 24, 27][index],
        dr: index < 4 ? 6 : 3,
      })),
      { cm: `hl:copy:${copyAnchor}`, tm: 0, dr: 30 },
      { cm: 'hl:entry', tm: 6, dr: 0 },
      { cm: 'hl:restore', tm: 24, dr: 0 },
    ],
  };
};

/** Generic viewport travel and an extendable line, independent of Santa artwork. */
export const historyViewportFixture = (): LottieComposition & {
  fr: number;
} => {
  const data = historyLadderFixture();
  data.layers.push(
    { ty: 3, ind: 18, nm: 'hl-anchor:viewport-start', ks: transform(0, 300) },
    { ty: 3, ind: 19, nm: 'hl-anchor:viewport-end', ks: transform(640, 300) },
    {
      ty: 4,
      ind: 20,
      nm: 'hl-flight-bounds',
      ks: transform(0, 0, 0),
      shapes: [shape(10, -10, 40, 40)],
    },
    {
      ty: 3,
      ind: 21,
      nm: 'hl-track:flight',
      ks: {
        ...transform(),
        p: {
          a: 1,
          k: [
            key(0, [-100, 300, 0]),
            key(12, [260, 300, 0]),
            key(24, [740, 300, 0]),
            key(30, [740, 300, 0]),
          ],
        },
      },
    },
    { ty: 3, ind: 22, nm: 'hl-follow:row-0', ks: transform(260, 100) },
    {
      ty: 4,
      ind: 23,
      nm: 'hl-if:drawn:top-line:row-0',
      parent: 22,
      ks: transform(),
      shapes: [
        {
          ty: 'sh',
          ks: at({
            v: [
              [-10, -80],
              [-10, -20],
            ],
            i: [
              [0, 0],
              [0, 0],
            ],
            o: [
              [0, 0],
              [0, 0],
            ],
            c: false,
          }),
        },
        { ty: 'st', c: at([0, 0, 0, 1]), o: at(100), w: at(4), lc: 2, lj: 2 },
      ],
    },
  );
  (data.markers as unknown[]).push(
    { cm: 'hl:edge-start', tm: 0, dr: 0 },
    { cm: 'hl:flight:viewport-start', tm: 0, dr: 12 },
    { cm: 'hl:flight:row-5', tm: 12, dr: 12 },
    { cm: 'hl:flight:viewport-end', tm: 24, dr: 6 },
  );
  return data;
};

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LottieLayer } from '../../models/lottie-composition';
import { historyLadderFixture } from '../../test-utils/history-ladder';
import { HistoryLadderAnchor } from '../../types/history-ladder';
import { readHistoryLadderMetadata } from '../history-ladder-contract';

const layer = (data: ReturnType<typeof historyLadderFixture>, name: string) => {
  const found = data.layers.find(({ nm }) => nm === name);
  if (!found) throw new Error(`Missing test layer ${name}`);
  return found;
};
const copy = (data: ReturnType<typeof historyLadderFixture>) =>
  layer(data, 'hl-track:copy');
const scalarKeys = (
  data: ReturnType<typeof historyLadderFixture>,
  name: 'r' | 'o',
) => copy(data).ks?.[name]?.k as { t: number; s: number[] }[];
const freeze = (value: unknown): void => {
  if (!value || typeof value !== 'object') return;
  Object.values(value).forEach(freeze);
  Object.freeze(value);
};

describe('history ladder contract', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads dynamic source stations without mutating or measuring anything', () => {
    const data = historyLadderFixture(HistoryLadderAnchor.Row4);
    const before = JSON.stringify(data);
    freeze(data);
    const query = vi.spyOn(document, 'querySelectorAll');
    const style = vi.spyOn(window, 'getComputedStyle');
    const clone = vi.spyOn(Node.prototype, 'cloneNode');
    const metadata = readHistoryLadderMetadata(data);
    expect(metadata.copyAnchor).toBe(HistoryLadderAnchor.Row4);
    expect(metadata.entry).toBe(6);
    expect(metadata.restore).toBe(24);
    expect(metadata.maxGap).toBe(80);
    expect(metadata.maxDrift).toBe(24);
    expect(metadata.references[HistoryLadderAnchor.Row5]).toEqual({
      x: 260,
      y: 300,
    });
    expect(metadata.composition).toBe(data);
    expect(JSON.stringify(data)).toBe(before);
    expect(query).not.toHaveBeenCalled();
    expect(style).not.toHaveBeenCalled();
    expect(clone).not.toHaveBeenCalled();
  });

  it('rejects an oversized root chain before traversing any layer metadata', () => {
    const data = historyLadderFixture();
    const layers = Array.from(
      { length: 49 },
      () =>
        new Proxy(
          {},
          {
            get: () => {
              throw new Error(
                'Metadata was inspected before the root-layer budget',
              );
            },
          },
        ),
    );
    data.layers = layers as LottieLayer[];
    expect(() => readHistoryLadderMetadata(data)).toThrow(
      'invalid composition',
    );
  });

  it.each([
    undefined,
    null,
    [],
    {},
    { ...historyLadderFixture(), fr: 0 },
    { ...historyLadderFixture(), ip: 1 },
  ])('rejects malformed composition %j', (data) =>
    expect(() => readHistoryLadderMetadata(data)).toThrow(),
  );

  it.each([
    'duplicate reference',
    'missing reference',
    'animated reference',
    'painted bounds',
    'transformed bounds',
    'unbounded range',
  ])('rejects %s before host work', (problem) => {
    const data = historyLadderFixture();
    const reference = layer(data, 'hl-anchor:row-0');
    const bounds = layer(data, 'hl-bounds:row-0');
    if (problem === 'duplicate reference')
      data.layers.push(structuredClone(reference));
    if (problem === 'missing reference')
      data.layers = data.layers.filter((entry) => entry !== reference);
    if (problem === 'animated reference' && reference.ks?.p)
      reference.ks.p.a = 1;
    if (problem === 'painted bounds')
      bounds.shapes?.push({ ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] } });
    if (problem === 'transformed bounds' && bounds.ks)
      bounds.ks.p = { a: 0, k: [10, 0, 0] };
    if (problem === 'unbounded range') {
      const shape = layer(data, 'hl-range').shapes?.[0];
      if (shape) shape.s = { a: 0, k: [24, 257] };
    }
    expect(() => readHistoryLadderMetadata(data)).toThrow();
  });

  it.each([
    'gap',
    'overlap',
    'unknown anchor',
    'copy source change',
    'missing restore',
    'entry too early',
  ])('rejects a marker %s', (problem) => {
    const data = historyLadderFixture();
    const markers = data.markers as { cm: string; tm: number; dr: number }[];
    if (problem === 'gap') markers[1].tm += 1;
    if (problem === 'overlap') markers[1].tm -= 1;
    if (problem === 'unknown anchor') markers[1].cm = 'hl:actor:row-6';
    if (problem === 'copy source change') {
      markers[6].dr = 12;
      markers.push({ cm: 'hl:copy:row-3', tm: 12, dr: 18 });
    }
    if (problem === 'missing restore')
      data.markers = markers.filter(({ cm }) => cm !== 'hl:restore');
    if (problem === 'entry too early') markers[7].tm = 0;
    expect(() => readHistoryLadderMetadata(data)).toThrow();
  });

  it.each([
    'wrong position',
    'rotation',
    'opacity',
    'mismatched timing',
    'animated scale',
    'spatial tangent',
  ])('rejects invalid copy %s', (problem) => {
    const data = historyLadderFixture();
    const track = copy(data);
    const positions = track.ks?.p?.k as {
      t: number;
      s: number[];
      to?: number[];
    }[];
    if (problem === 'wrong position') positions[1].s[0] += 1;
    if (problem === 'rotation') scalarKeys(data, 'r')[1].s[0] = 1;
    if (problem === 'opacity') scalarKeys(data, 'o')[1].s[0] = 50;
    if (problem === 'mismatched timing') scalarKeys(data, 'r')[2].t = 13;
    if (problem === 'animated scale' && track.ks)
      track.ks.s = { a: 1, k: [{ t: 0, s: [100, 100, 100] }] };
    if (problem === 'spatial tangent') positions[2].to = [1, 0, 0];
    expect(() => readHistoryLadderMetadata(data)).toThrow();
  });

  it.each([
    ['r', NaN],
    ['r', Infinity],
    ['r', 1e12],
    ['o', NaN],
    ['o', -1],
    ['o', 101],
  ] as const)(
    'rejects intermediate %s=%s without trusting only entry/end values',
    (property, value) => {
      const data = historyLadderFixture();
      scalarKeys(data, property)[2].s[0] = value;
      expect(() => readHistoryLadderMetadata(data)).toThrow();
    },
  );

  it.each([
    'auto-orient',
    'split position',
    'position expression',
    '3d track',
    'duplicate index',
    'non-finite index',
    'root time remap',
  ])('rejects a mapping-changing %s', (problem) => {
    const data = historyLadderFixture();
    const actor = layer(data, 'hl-track:actor');
    if (problem === 'auto-orient') actor.ao = 1;
    if (problem === 'split position')
      Object.assign(actor.ks?.p ?? {}, { s: true });
    if (problem === 'position expression')
      Object.assign(actor.ks?.p ?? {}, { x: 'value + [1, 0]' });
    if (problem === '3d track') actor.ddd = 1;
    if (problem === 'duplicate index') actor.ind = 1;
    if (problem === 'non-finite index') actor.ind = NaN;
    if (problem === 'root time remap') actor.tm = { a: 0, k: 0 };
    expect(() => readHistoryLadderMetadata(data)).toThrow();
  });

  it.each([
    'hl-anchor:row-6',
    'hl-bounds:row-6',
    'hl-anchor:__proto__',
    'hl-bounds:constructor',
  ])('rejects unknown metadata %s', (name) => {
    const data = historyLadderFixture();
    const template = name.startsWith('hl-anchor:')
      ? 'hl-anchor:row-0'
      : 'hl-bounds:row-0';
    data.layers.push({
      ...structuredClone(layer(data, template)),
      ind: 99,
      nm: name,
    });
    expect(() => readHistoryLadderMetadata(data)).toThrow();
  });

  it('rejects unowned visible layers and parent cycles', () => {
    const data = historyLadderFixture();
    const branch = layer(data, 'hl-if:drawn');
    branch.parent = undefined;
    expect(() => readHistoryLadderMetadata(data)).toThrow();
    branch.parent = branch.ind;
    expect(() => readHistoryLadderMetadata(data)).toThrow();
  });

  it('rejects unknown branch names instead of leaving both alternatives visible', () => {
    const data = historyLadderFixture();
    layer(data, 'hl-if:history').nm = 'hl-if:unknown';
    expect(() => readHistoryLadderMetadata(data)).toThrow();
  });

  it.each(['actor', 'copy'])(
    'rejects missing non-hold easing handles on %s',
    (name) => {
      const data = historyLadderFixture();
      const keys = layer(data, `hl-track:${name}`).ks?.p?.k as {
        o?: unknown;
      }[];
      delete keys[0].o;
      expect(() => readHistoryLadderMetadata(data)).toThrow();
    },
  );

  it('rejects scalar easing that differs from its position track', () => {
    const data = historyLadderFixture();
    const keys = scalarKeys(data, 'r') as {
      t: number;
      s: number[];
      o: { x: number[]; y: number[] };
    }[];
    keys[2].o.y = [0.5];
    expect(() => readHistoryLadderMetadata(data)).toThrow();
  });

  it.each(['early fade', 'late fade', 'source change during restoration'])(
    'rejects copy visibility outside the borrowing window: %s',
    (problem) => {
      const data = historyLadderFixture();
      const track = copy(data);
      if (problem === 'early fade') {
        for (const name of ['p', 'r', 'o'] as const)
          delete (track.ks?.[name]?.k as { h?: number }[])[0].h;
      }
      if (problem === 'late fade') scalarKeys(data, 'o')[4].s[0] = 100;
      if (problem === 'source change during restoration') {
        const markers = data.markers as {
          cm: string;
          tm: number;
          dr: number;
        }[];
        markers[6].dr = 24.3;
        markers.push({ cm: 'hl:copy:row-3', tm: 24.3, dr: 5.7 });
      }
      expect(() => readHistoryLadderMetadata(data)).toThrow();
    },
  );

  it('retains authored key count and easing while parsing a valid follower', () => {
    const data = historyLadderFixture();
    const track = copy(data);
    const before = JSON.stringify(track);
    const follower: LottieLayer = {
      ty: 3,
      ind: 20,
      nm: 'hl-follow:row-5',
      ks: { p: { a: 0, k: [260, 300, 0] } },
    };
    data.layers.push(follower);
    expect(readHistoryLadderMetadata(data).composition.layers).toContain(
      follower,
    );
    expect(JSON.stringify(track)).toBe(before);
  });

  it('accepts one optional invisible drawn-only envelope without changing the six station envelopes', () => {
    const data = historyLadderFixture();
    const drawn = {
      ...structuredClone(layer(data, 'hl-bounds:row-0')),
      ind: 99,
      nm: 'hl-drawn-bounds',
    };
    if (drawn.shapes?.[0]) drawn.shapes[0].s = { a: 0, k: [320, 300] };
    data.layers.push(drawn);
    const metadata = readHistoryLadderMetadata(data);
    expect(metadata.drawnBounds?.width).toBe(320);
    expect(metadata.drawnBounds?.height).toBe(300);
    expect(Object.keys(metadata.bounds)).toHaveLength(6);
    expect(metadata.bounds[HistoryLadderAnchor.Row0].width).toBe(100);
  });

  it.each(['duplicate', 'painted', 'animated'])(
    'rejects a %s drawn-only envelope',
    (problem) => {
      const data = historyLadderFixture();
      const drawn = {
        ...structuredClone(layer(data, 'hl-bounds:row-0')),
        ind: 99,
        nm: 'hl-drawn-bounds',
      };
      data.layers.push(drawn);
      if (problem === 'duplicate')
        data.layers.push({ ...structuredClone(drawn), ind: 100 });
      if (problem === 'painted')
        drawn.shapes?.push({ ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] } });
      if (problem === 'animated' && drawn.shapes?.[0])
        drawn.shapes[0].s = { a: 1, k: [{ t: 0, s: [320, 300] }] };
      expect(() => readHistoryLadderMetadata(data)).toThrow();
    },
  );
});

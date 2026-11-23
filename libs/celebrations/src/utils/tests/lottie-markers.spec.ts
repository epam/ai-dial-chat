import { describe, expect, it } from 'vitest';
import type { LottieMarkerVocabulary } from '../../models/lottie-markers';
import { findNamespacedRange, readNamespacedMarkers } from '../lottie-markers';

const PRIZES = ['0', '1'];

const VOCABULARY: LottieMarkerVocabulary = {
  namespace: 'cat',
  scopeKind: 'section',
  kinds: {
    section: { arguments: ['two-prizes', 'one-prize'], duration: true },
    bind: {
      arguments: ['perch', 'prize-0', 'prize-1'],
      duration: true,
      exclusive: true,
    },
    entry: { arguments: PRIZES, duration: false },
    contact: { arguments: PRIZES, duration: false, maxPerScope: 4 },
    release: { arguments: PRIZES, duration: false },
    landing: { arguments: PRIZES },
    restore: { duration: false },
  },
  order: ['entry', 'contact', 'release', 'landing', 'restore'],
};

const RANGE = { from: 0, to: 2000 };

const marker = (cm: string, tm: number, dr?: number) =>
  dr === undefined ? { cm, tm } : { cm, tm, dr };

const SECTION = marker('cat:section:two-prizes', 0, 1500);

const read = (...markers: object[]) =>
  readNamespacedMarkers({ markers }, VOCABULARY, RANGE);

describe('readNamespacedMarkers', () => {
  it('groups the namespace markers by section in time order', () => {
    const scopes = read(
      marker('cat:section:one-prize', 1500, 400),
      marker('cat:release:0', 600),
      SECTION,
      marker('cat:entry:0', 300),
      marker('cat:bind:perch', 100, 200),
      marker('cat:release:0', 1600),
    );

    expect(scopes.map(({ marker: scope }) => scope?.argument)).toEqual([
      'two-prizes',
      'one-prize',
    ]);
    expect(scopes[0].markers.map(({ kind }) => kind)).toEqual([
      'bind',
      'entry',
      'release',
    ]);
    expect(scopes[0].markers[0]).toEqual({
      kind: 'bind',
      argument: 'perch',
      frame: 100,
      duration: 200,
    });
    expect(scopes[1].markers).toEqual([
      { kind: 'release', argument: '0', frame: 1600, duration: 0 },
    ]);
  });

  it('ignores markers of other namespaces, including JSON payloads', () => {
    const scopes = read(
      SECTION,
      marker('intro', 10),
      marker('{"note":"cat:release:0"}', 20),
      marker('penguin:grip', 30),
      marker('category:bind:perch', 40),
    );

    expect(scopes).toHaveLength(1);
    expect(scopes[0].markers).toEqual([]);
  });

  it('returns no scope when the composition has no markers', () => {
    expect(readNamespacedMarkers({}, VOCABULARY, RANGE)).toEqual([]);
  });

  it('returns one timeline scope when the vocabulary has no scope kind', () => {
    const scopes = readNamespacedMarkers(
      { markers: [marker('cat:restore', 900)] },
      { namespace: 'cat', kinds: { restore: {} } },
      RANGE,
    );

    expect(scopes).toEqual([
      {
        markers: [
          { kind: 'restore', argument: undefined, frame: 900, duration: 0 },
        ],
      },
    ]);
  });

  it('accepts up to four contacts of one prize in a section', () => {
    const contacts = [400, 450, 500, 550].map((tm) =>
      marker('cat:contact:0', tm),
    );

    expect(read(SECTION, ...contacts)[0].markers).toHaveLength(4);
  });

  it.each([
    ['an unknown kind', [marker('cat:jump', 10)], 'unknown "cat:jump"'],
    ['an extra segment', [marker('cat:release:0:late', 10)], 'unknown'],
    [
      'an unknown argument',
      [marker('cat:bind:sofa', 10, 5)],
      'unknown argument',
    ],
    ['a missing argument', [marker('cat:release', 10)], 'unknown argument'],
    [
      'an unexpected argument',
      [marker('cat:restore:0', 10)],
      'unknown argument',
    ],
    [
      'a forbidden duration',
      [marker('cat:release:0', 10, 5)],
      'must not have a duration',
    ],
    ['a missing duration', [marker('cat:bind:perch', 10)], 'needs a duration'],
    ['a negative frame', [marker('cat:release:0', -1)], 'outside frames'],
    [
      'a range past the end',
      [marker('cat:bind:perch', 1990, 20)],
      'outside frames',
    ],
    [
      'a non-numeric frame',
      [{ cm: 'cat:release:0', tm: '10' }],
      'outside frames',
    ],
  ])('rejects %s', (_case, markers, message) => {
    expect(() => read(SECTION, ...markers)).toThrow(message);
  });

  it('rejects a marker repeated within a section', () => {
    expect(() =>
      read(SECTION, marker('cat:release:0', 600), marker('cat:release:0', 700)),
    ).toThrow('"release:0" repeats');
  });

  it('rejects a fifth contact of one prize', () => {
    const contacts = [400, 450, 500, 550, 560].map((tm) =>
      marker('cat:contact:0', tm),
    );

    expect(() => read(SECTION, ...contacts)).toThrow('"contact:0" repeats');
  });

  it('rejects overlapping bind ranges', () => {
    expect(() =>
      read(
        SECTION,
        marker('cat:bind:perch', 100, 200),
        marker('cat:bind:prize-0', 250, 100),
      ),
    ).toThrow('overlaps');
  });

  it('accepts bind ranges that touch', () => {
    expect(
      read(
        SECTION,
        marker('cat:bind:perch', 100, 200),
        marker('cat:bind:prize-0', 300, 100),
      )[0].markers,
    ).toHaveLength(2);
  });

  it('rejects a release before a contact of the same prize', () => {
    expect(() =>
      read(SECTION, marker('cat:contact:0', 500), marker('cat:release:0', 400)),
    ).toThrow('"release:0" comes before "contact:0"');
  });

  it('compares a marker without argument with every prize', () => {
    expect(() =>
      read(SECTION, marker('cat:landing:1', 900), marker('cat:restore', 800)),
    ).toThrow('"restore" comes before "landing:1"');
  });

  it('does not order markers of different prizes', () => {
    expect(
      read(SECTION, marker('cat:release:0', 800), marker('cat:entry:1', 700))[0]
        .markers,
    ).toHaveLength(2);
  });

  it('puts a marker on a shared boundary into the section it opens', () => {
    const scopes = read(
      SECTION,
      marker('cat:section:one-prize', 1500, 400),
      marker('cat:release:0', 1500),
      marker('cat:restore', 1900),
    );

    expect(scopes[0].markers).toEqual([]);
    expect(scopes[1].markers.map(({ kind }) => kind)).toEqual([
      'release',
      'restore',
    ]);
  });

  it('rejects a marker outside every section', () => {
    expect(() => read(SECTION, marker('cat:release:0', 1700))).toThrow(
      'outside every scope',
    );
  });

  it('rejects overlapping sections', () => {
    expect(() =>
      read(SECTION, marker('cat:section:one-prize', 1400, 300)),
    ).toThrow('overlaps');
  });

  it('rejects markers that are not a list', () => {
    expect(() =>
      readNamespacedMarkers({ markers: {} }, VOCABULARY, RANGE),
    ).toThrow('not a list');
  });
});

describe('findNamespacedRange', () => {
  const range = (frame: number, duration: number) => ({
    kind: 'bind',
    argument: String(frame),
    frame,
    duration,
  });
  const ranges = [range(0, 10), range(10, 5)];

  it('gives a shared boundary to the later range and a final end to the range it ends', () => {
    expect(findNamespacedRange(ranges, 10)?.frame).toBe(10);
    expect(findNamespacedRange(ranges, 15)?.frame).toBe(10);
    expect(findNamespacedRange(ranges, 9.999_999_9)?.frame).toBe(10);
    expect(findNamespacedRange(ranges, 4)?.frame).toBe(0);
  });

  it('finds no range outside every range', () => {
    expect(findNamespacedRange(ranges, 15.1)).toBeUndefined();
    expect(findNamespacedRange(ranges, -1)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { CopyTrackRole, CopyTrackStage } from '../../types/copy-track';
import { readCopyTrackMarkers } from '../copy-track-markers';

const RANGE = { from: 0, to: 2100 };

const marker = (cm: string, tm: number, dr = 0) => ({ cm, tm, dr });

const validMarkers = () => [
  marker('ct:section:ledge-card', 0),
  marker('ct:section:rim-card', 0),
  marker('ct:section:rim', 0),
  marker('ct:trunk', 0, 1500),
  marker('ct:cut:rim-card', 240, 114),
  marker('ct:fill:rim-card', 1500, 114),
  marker('ct:cut:rim', 240, 114),
  marker('ct:cut:rim', 1260, 132),
  marker('ct:fill:rim', 1620, 114),
  marker('ct:fill:rim', 1740, 132),
  marker('ct:bind:entry-edge', 0, 240),
  marker('ct:bind:span-start', 240, 336),
  marker('ct:stretch', 576, 144),
  marker('ct:bind:span-end', 720, 780),
  marker('ct:cycle:0', 1311, 14),
  marker('ct:cycle-window:0', 1311, 42),
  marker('ct:entry', 240),
  marker('ct:restore', 1392),
  marker('ct:contact:grip', 258),
  marker('ct:contact:impact', 720),
  marker('penguin:grip', 3),
];

const read = (markers = validMarkers()) =>
  readCopyTrackMarkers({ markers }, RANGE);

describe('readCopyTrackMarkers', () => {
  it('reads sections in priority order with their stage and role', () => {
    expect(read().sections).toEqual([
      {
        kind: 'ledge-card',
        stage: CopyTrackStage.Ledge,
        role: CopyTrackRole.StarterCard,
      },
      {
        kind: 'rim-card',
        stage: CopyTrackStage.Rim,
        role: CopyTrackRole.StarterCard,
      },
      { kind: 'rim', stage: CopyTrackStage.Rim },
    ]);
  });

  it('pairs each cut with its fill in trunk order', () => {
    expect(read().splices.rim).toEqual([
      { cut: { from: 240, to: 354 }, fill: { from: 1620, to: 1734 } },
      { cut: { from: 1260, to: 1392 }, fill: { from: 1740, to: 1872 } },
    ]);
  });

  it('reads the trunk, ranges, cycles, copy window and contacts, ignoring other namespaces', () => {
    const markers = read();

    expect(markers.trunk).toEqual({ from: 0, to: 1500 });
    expect(markers.binds.map(({ argument }) => argument)).toEqual([
      'entry-edge',
      'span-start',
      'span-end',
    ]);
    expect(markers.stretches).toHaveLength(1);
    expect(markers.cycles).toEqual([
      {
        slot: '0',
        cycle: { from: 1311, to: 1325 },
        window: { from: 1311, to: 1353 },
      },
    ]);
    expect([markers.entryFrame, markers.restoreFrame]).toEqual([240, 1392]);
    expect(markers.contacts).toHaveLength(2);
  });

  it.each([
    [
      'an unknown section kind',
      [marker('ct:section:sky', 0)],
      'unknown argument',
    ],
    [
      'an unknown role-bearing kind in a cut',
      [marker('ct:cut:sky', 0, 10)],
      'unknown argument',
    ],
    [
      'an orphan fill',
      [marker('ct:fill:platform', 1900, 10)],
      'cuts and 1 fills',
    ],
    [
      'a fill of another length',
      [
        marker('ct:cut:platform', 400, 20),
        marker('ct:fill:platform', 1900, 10),
        marker('ct:section:platform', 0),
      ],
      'does not last as long',
    ],
    [
      'a fill inside the trunk',
      [
        marker('ct:cut:platform', 400, 20),
        marker('ct:fill:platform', 1000, 20),
        marker('ct:section:platform', 0),
      ],
      'lies inside the trunk',
    ],
    [
      'splices without a section',
      [
        marker('ct:cut:platform', 400, 20),
        marker('ct:fill:platform', 1900, 20),
      ],
      'has splices but no section',
    ],
    ['a second trunk', [marker('ct:trunk', 1500, 10)], 'repeats'],
    ['a stretch over a bind', [marker('ct:stretch', 700, 40)], 'overlap'],
    [
      'a cycle window across a cut boundary',
      [marker('ct:cycle:1', 230, 10), marker('ct:cycle-window:1', 230, 30)],
      'crosses a cut boundary',
    ],
    [
      'a cycle window outside the trunk and every fill',
      [marker('ct:cycle:1', 2000, 10), marker('ct:cycle-window:1', 2000, 30)],
      'neither the trunk nor one fill',
    ],
    [
      'a cycle without a window',
      [marker('ct:cycle:2', 900, 10)],
      'exactly one window',
    ],
    [
      'a cycle outside its window',
      [marker('ct:cycle:3', 900, 10), marker('ct:cycle-window:3', 950, 30)],
      'lies outside its window',
    ],
  ])('rejects %s', (_case, extra, message) => {
    expect(() => read([...validMarkers(), ...extra])).toThrow(message);
  });

  it('accepts a cycle window inside a fill', () => {
    const markers = read([
      ...validMarkers(),
      marker('ct:cycle:1', 1791, 14),
      marker('ct:cycle-window:1', 1791, 42),
    ]);

    expect(markers.cycles.map(({ slot }) => slot)).toEqual(['0', '1']);
  });

  it('lets two kinds share one fill window exactly', () => {
    const markers = read([
      ...validMarkers(),
      marker('ct:section:platform', 0),
      marker('ct:cut:platform', 240, 114),
      marker('ct:fill:platform', 1620, 114),
    ]);

    expect(markers.splices.platform?.[0].fill).toEqual({
      from: 1620,
      to: 1734,
    });
  });

  it('rejects fills that overlap without matching exactly', () => {
    expect(() =>
      read([
        ...validMarkers(),
        marker('ct:section:platform', 0),
        marker('ct:cut:platform', 240, 114),
        marker('ct:fill:platform', 1630, 114),
      ]),
    ).toThrow('overlap');
  });

  it('rejects a copying section without entry and restore markers', () => {
    const markers = validMarkers().filter(({ cm }) => cm !== 'ct:restore');

    expect(() => read(markers)).toThrow('entry or restore marker is missing');
  });

  it('rejects a restore before the entry', () => {
    const markers = validMarkers().map((entry) =>
      entry.cm === 'ct:restore' ? marker('ct:restore', 100) : entry,
    );

    expect(() => read(markers)).toThrow('comes before');
  });

  it('rejects an asset without sections', () => {
    expect(() => read([marker('ct:trunk', 0, 1500)])).toThrow('no section');
  });
});

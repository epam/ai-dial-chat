import { describe, expect, it } from 'vitest';
import type { CornerRect } from '../../models/composer-corner';
import type { LottieLayer } from '../../models/lottie-composition';
import { historyViewportFixture } from '../../test-utils/history-ladder';
import { HistoryLadderMode } from '../../types/history-ladder';
import { readHistoryLadderMetadata } from '../history-ladder-contract';
import {
  HISTORY_TOP_LINE,
  historyViewportPoints,
  isHistoryViewportRouteSafe,
  mapHistoryTopLine,
} from '../history-ladder-viewport';

const rect = (
  left: number,
  top: number,
  width: number,
  height: number,
): CornerRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const layer = (data: ReturnType<typeof historyViewportFixture>, name: string) =>
  data.layers.find(({ nm }) => nm === name) as LottieLayer;

describe('history viewport travel', () => {
  it('keeps edge targets in visible viewport coordinates, including RTL and visual offsets', () => {
    const points = { 'row-5': { x: 900, y: 500 } };
    const viewport = rect(40, 60, 1000, 700);
    expect(historyViewportPoints(points, 1, viewport)).toMatchObject({
      'viewport-start': { x: 40, y: 500 },
      'viewport-end': { x: 1040, y: 500 },
    });
    expect(
      historyViewportPoints(points, -1, viewport)['viewport-start'],
    ).toEqual({ x: 1040, y: 500 });
  });

  it('extends only the private line endpoint to beyond the visible top', () => {
    const source = historyViewportFixture();
    const mapped = structuredClone(source);
    layer(mapped, 'hl-follow:row-0').ks = { p: { a: 0, k: [300, 200, 0] } };
    mapHistoryTopLine(mapped.layers, rect(0, 40, 1280, 700));
    expect(layer(mapped, HISTORY_TOP_LINE).shapes?.[0].ks?.k).toMatchObject({
      v: [
        [-10, -164],
        [-10, -20],
      ],
    });
    expect(layer(source, HISTORY_TOP_LINE).shapes?.[0].ks?.k).toMatchObject({
      v: [
        [-10, -80],
        [-10, -20],
      ],
    });
  });

  it('allows offscreen travel but rejects the complete swept corridor over controls', () => {
    const metadata = readHistoryLadderMetadata(historyViewportFixture());
    const viewport = rect(0, 0, 1280, 800);
    const safe = (obstacle: CornerRect) =>
      isHistoryViewportRouteSafe(
        metadata,
        metadata.composition.layers,
        1,
        viewport,
        [obstacle],
        HistoryLadderMode.History,
      );
    expect(safe(rect(500, 500, 300, 80))).toBe(true);
    expect(safe(rect(100, 280, 10, 10))).toBe(false);
    expect(safe(rect(600, 280, 10, 10))).toBe(false);
  });

  it('checks the rope above its authored envelope only in the drawn route', () => {
    const metadata = readHistoryLadderMetadata(historyViewportFixture());
    metadata.flightBounds = undefined;
    const safe = (mode: HistoryLadderMode) =>
      isHistoryViewportRouteSafe(
        metadata,
        metadata.composition.layers,
        1,
        rect(0, 0, 1280, 800),
        [rect(245, 10, 10, 10)],
        mode,
      );
    expect(safe(HistoryLadderMode.Drawn)).toBe(false);
    expect(safe(HistoryLadderMode.History)).toBe(true);
  });

  it.each([
    'hl-anchor:viewport-start',
    'hl-anchor:viewport-end',
    'hl-flight-bounds',
  ])('requires %s when the flight track is present', (name) => {
    const data = historyViewportFixture();
    data.layers = data.layers.filter(({ nm }) => nm !== name);
    expect(() => readHistoryLadderMetadata(data)).toThrow(
      `expected one ${name}`,
    );
  });

  it.each([
    [
      'curved line',
      (line: LottieLayer) => {
        (line.shapes?.[0].ks?.k as { i: number[][] }).i[0][0] = 10;
      },
    ],
    [
      'rotated line',
      (line: LottieLayer) => {
        line.ks = { ...line.ks, r: { a: 0, k: 5 } };
      },
    ],
    [
      'wrong parent',
      (line: LottieLayer) => {
        line.parent = 14;
      },
    ],
    [
      'painted fill',
      (line: LottieLayer) => {
        line.shapes?.push({ ty: 'fl' });
      },
    ],
  ] as const)('rejects a %s before viewport mapping', (_name, edit) => {
    const data = historyViewportFixture();
    edit(layer(data, HISTORY_TOP_LINE));
    expect(() => readHistoryLadderMetadata(data)).toThrow(
      'invalid viewport top line',
    );
  });

  it('rejects viewport bindings on the borrowed text track', () => {
    const data = historyViewportFixture();
    const marker = (data.markers as { cm: string }[]).find(({ cm }) =>
      cm.startsWith('hl:copy:'),
    );
    if (!marker) throw new Error('Missing fixture marker');
    marker.cm = 'hl:copy:viewport-end';
    expect(() => readHistoryLadderMetadata(data)).toThrow();
  });
});

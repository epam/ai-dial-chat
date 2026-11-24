import { describe, expect, it } from 'vitest';
import type { LottieLayer } from '../../models/lottie-composition';
import { isHistoryLadderCopyPathSafe } from '../history-ladder-copy';

const viewport = new DOMRect(12, 20, 976, 760);
const track = (
  positions = [
    [300, 100],
    [300, 140],
  ],
  rotations = [0, 0],
  opacity = [100, 100],
): LottieLayer => ({
  ty: 3,
  nm: 'hl-track:copy',
  ks: {
    p: { a: 1, k: positions.map((s, t) => ({ t, s })) },
    r: { a: 1, k: rotations.map((value, t) => ({ t, s: [value] })) },
    o: { a: 1, k: opacity.map((value, t) => ({ t, s: [value] })) },
  },
});

describe('history ladder swept copy bounds', () => {
  it('keeps live text upright on either inline edge without mutating its track', () => {
    const data = track();
    const before = JSON.stringify(data);
    expect(isHistoryLadderCopyPathSafe(data, 200, 32, 1, viewport, [])).toBe(
      true,
    );
    expect(isHistoryLadderCopyPathSafe(data, 200, 32, -1, viewport, [])).toBe(
      true,
    );
    expect(JSON.stringify(data)).toBe(before);
    const rightObstacle = new DOMRect(450, 120, 10, 10);
    expect(
      isHistoryLadderCopyPathSafe(data, 200, 32, 1, viewport, [rightObstacle]),
    ).toBe(true);
    expect(
      isHistoryLadderCopyPathSafe(data, 200, 32, -1, viewport, [rightObstacle]),
    ).toBe(false);
  });

  it('rejects a protected control between otherwise clear translation endpoints', () => {
    const data = track([
      [300, 100],
      [500, 300],
    ]);
    const obstacle = new DOMRect(340, 190, 20, 20);
    expect(
      isHistoryLadderCopyPathSafe(data, 100, 20, 1, viewport, [obstacle]),
    ).toBe(false);
  });

  it('checks rotational extrema between keys, including a full half-turn', () => {
    const data = track(
      [
        [400, 400],
        [400, 400],
      ],
      [0, 180],
    );
    const obstacle = new DOMRect(390, 305, 20, 10);
    expect(
      isHistoryLadderCopyPathSafe(data, 100, 20, 1, viewport, [obstacle]),
    ).toBe(false);
  });

  it('rejects a rotation that crosses the viewport even when key endpoint rectangles fit', () => {
    const data = track(
      [
        [300, 100],
        [300, 100],
      ],
      [0, 180],
    );
    expect(isHistoryLadderCopyPathSafe(data, 100, 20, 1, viewport, [])).toBe(
      false,
    );
  });

  it('allows touching a protected edge but rejects any positive-area overlap', () => {
    const data = track([
      [300, 100],
      [300, 100],
    ]);
    expect(
      isHistoryLadderCopyPathSafe(data, 200, 32, 1, viewport, [
        new DOMRect(300, 100, 20, 20),
      ]),
    ).toBe(true);
    expect(
      isHistoryLadderCopyPathSafe(data, 200, 32, 1, viewport, [
        new DOMRect(299, 100, 20, 20),
      ]),
    ).toBe(false);
  });

  it('ignores completely invisible segments but checks a fade into visible artwork', () => {
    const hidden = track(
      [
        [-1000, -1000],
        [-900, -900],
      ],
      [0, 0],
      [0, 0],
    );
    expect(isHistoryLadderCopyPathSafe(hidden, 100, 20, 1, viewport, [])).toBe(
      true,
    );
    const fade = track(
      [
        [-1000, -1000],
        [300, 100],
      ],
      [0, 0],
      [0, 100],
    );
    expect(isHistoryLadderCopyPathSafe(fade, 100, 20, 1, viewport, [])).toBe(
      false,
    );
  });

  it('rejects non-finite swept coordinates', () => {
    const data = track([
      [300, 100],
      [NaN, 100],
    ]);
    expect(isHistoryLadderCopyPathSafe(data, 100, 20, 1, viewport, [])).toBe(
      false,
    );
  });
});

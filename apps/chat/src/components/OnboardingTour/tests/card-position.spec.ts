import { describe, expect, it } from 'vitest';
import {
  computeCardPosition,
  TARGET_GAP,
  VIEWPORT_MARGIN,
} from '../card-position';

const viewport = { width: 1200, height: 800 };
const card = { width: 300, height: 150 };

describe('computeCardPosition', () => {
  it('places the card below the target, start-aligned in LTR', () => {
    const target = { top: 100, left: 200, width: 80, height: 40 };
    expect(computeCardPosition(target, card, viewport, false)).toEqual({
      top: 140 + TARGET_GAP,
      left: 200,
    });
  });

  it('aligns the card with the target end edge in RTL', () => {
    const target = { top: 100, left: 800, width: 80, height: 40 };
    expect(computeCardPosition(target, card, viewport, true)).toEqual({
      top: 140 + TARGET_GAP,
      left: 880 - 300,
    });
  });

  it('flips above when there is no room below', () => {
    const target = { top: 700, left: 200, width: 80, height: 40 };
    expect(computeCardPosition(target, card, viewport, false)).toEqual({
      top: 700 - TARGET_GAP - 150,
      left: 200,
    });
  });

  it('puts the card beside a full-height target', () => {
    const target = { top: 0, left: 0, width: 260, height: 800 };
    expect(computeCardPosition(target, card, viewport, false)).toEqual({
      top: VIEWPORT_MARGIN,
      left: 260 + TARGET_GAP,
    });
  });

  it('clamps the card into the viewport', () => {
    const target = { top: 100, left: 1150, width: 40, height: 40 };
    expect(computeCardPosition(target, card, viewport, false).left).toBe(
      1200 - 300 - VIEWPORT_MARGIN,
    );
  });
});

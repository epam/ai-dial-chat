import { describe, expect, it } from 'vitest';
import type { CornerRect } from '../../models/composer-corner';
import { cornerRectsIntersect } from '../composer-corner-geometry';
import { findComposerCornerPosterPlacement } from '../composer-corner-poster';

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

describe('corner poster placement', () => {
  it('keeps a portrait readable above a docked input without covering controls', () => {
    const viewport = rect(12, 20, 336, 680);
    const protectedRects = [rect(16, 610, 328, 90), rect(220, 20, 100, 60)];
    const result = findComposerCornerPosterPlacement(
      viewport,
      protectedRects,
      0.75,
      'ltr',
    );
    expect(result).not.toBeNull();
    expect(result?.width).toBe(150);
    expect(result?.height).toBe(200);
    expect(result?.bottom).toBeLessThanOrEqual(610);
    expect(
      protectedRects.some(
        (target) => result && cornerRectsIntersect(result, target),
      ),
    ).toBe(false);
  });

  it('uses an offset visual viewport rather than assuming an origin of zero', () => {
    const viewport = rect(60, 130, 240, 260);
    const result = findComposerCornerPosterPlacement(
      viewport,
      [rect(60, 250, 240, 140)],
      1,
      'ltr',
    );
    expect(result?.width).toBe(120);
    expect(result?.left).toBeGreaterThanOrEqual(60);
    expect(result?.top).toBe(130);
    expect(result?.right).toBeLessThanOrEqual(300);
    expect(result?.bottom).toBe(250);
  });

  it('accepts the readability boundary and rejects a slot just below it', () => {
    expect(
      findComposerCornerPosterPlacement(rect(0, 0, 96, 150), [], 1, 'ltr')
        ?.width,
    ).toBe(96);
    expect(
      findComposerCornerPosterPlacement(rect(0, 0, 95.99, 150), [], 1, 'ltr'),
    ).toBeNull();
  });

  it('caps the long edge and preserves the image aspect ratio', () => {
    const result = findComposerCornerPosterPlacement(
      rect(0, 0, 1000, 1000),
      [],
      2,
      'ltr',
    );
    expect(result?.width).toBe(200);
    expect(result?.height).toBe(100);
  });

  it.each([3, 0.3])(
    'omits an aspect ratio of %s that cannot meet both size limits',
    (aspect) => {
      expect(
        findComposerCornerPosterPlacement(
          rect(0, 0, 1000, 1000),
          [],
          aspect,
          'ltr',
        ),
      ).toBeNull();
    },
  );

  it('omits the still when protected content occupies every readable slot', () => {
    const viewport = rect(12, 20, 336, 600);
    expect(
      findComposerCornerPosterPlacement(viewport, [viewport], 1, 'ltr'),
    ).toBeNull();
  });

  it('allows border contact while rejecting positive-area overlap', () => {
    const obstacle = rect(0, 200, 200, 100);
    const result = findComposerCornerPosterPlacement(
      rect(0, 0, 200, 300),
      [obstacle],
      1,
      'ltr',
    );
    expect(result?.bottom).toBe(obstacle.top);
  });

  it('prefers the logical end without changing the image geometry', () => {
    const viewport = rect(12, 20, 336, 680);
    const ltr = findComposerCornerPosterPlacement(viewport, [], 1, 'ltr');
    const rtl = findComposerCornerPosterPlacement(viewport, [], 1, 'rtl');
    expect(ltr?.right).toBe(viewport.right);
    expect(rtl?.left).toBe(viewport.left);
    expect(ltr?.width).toBe(rtl?.width);
  });

  it('ignores protected rectangles entirely outside the visible viewport', () => {
    const viewport = rect(12, 20, 336, 680);
    expect(
      findComposerCornerPosterPlacement(
        viewport,
        [rect(400, 100, 500, 100)],
        1,
        'ltr',
      ),
    ).toEqual(findComposerCornerPosterPlacement(viewport, [], 1, 'ltr'));
  });

  it.each([0, -1, NaN, Infinity])(
    'rejects an invalid image aspect ratio %s',
    (aspect) => {
      expect(
        findComposerCornerPosterPlacement(
          rect(0, 0, 300, 300),
          [],
          aspect,
          'ltr',
        ),
      ).toBeNull();
    },
  );

  it('fails closed on malformed geometry or an excessive protected-target list', () => {
    const viewport = rect(0, 0, 300, 300);
    expect(
      findComposerCornerPosterPlacement(
        { ...viewport, left: NaN },
        [],
        1,
        'ltr',
      ),
    ).toBeNull();
    expect(
      findComposerCornerPosterPlacement(
        viewport,
        [{ ...viewport, width: 1 }],
        1,
        'ltr',
      ),
    ).toBeNull();
    expect(
      findComposerCornerPosterPlacement(
        viewport,
        Array.from({ length: 33 }, () => viewport),
        1,
        'ltr',
      ),
    ).toBeNull();
  });

  it('does not modify shared measurements while finding a slot', () => {
    const viewport = Object.freeze(rect(12, 20, 336, 680));
    const obstacle = Object.freeze(rect(16, 610, 328, 90));
    expect(
      findComposerCornerPosterPlacement(
        viewport,
        Object.freeze([obstacle]),
        1,
        'ltr',
      ),
    ).not.toBeNull();
    expect(obstacle).toEqual(rect(16, 610, 328, 90));
  });
});

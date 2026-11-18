import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CelebrationComposerAnchorPlacement } from '../../models/celebration-pack';
import type { LottieComposition } from '../../models/lottie-composition';
import {
  CelebrationAnchor,
  CelebrationAnchorEdge,
  CelebrationAnchorFallback,
  CelebrationPlacementTemplate,
} from '../../types/celebration-pack';
import {
  COMPOSER_ANCHOR_LAYER_NAME,
  rebaseStageOntoViewport,
  resolveComposerAnchor,
  resolveSyntheticAnchorBox,
  type ComposerAnchorMapping,
} from '../composer-anchor';

const DESKTOP: CelebrationComposerAnchorPlacement = {
  template: CelebrationPlacementTemplate.ComposerAnchorV1,
  anchor: CelebrationAnchor.Composer,
  anchorRect: { x: 340, y: 164, width: 520, height: 56 },
  edge: CelebrationAnchorEdge.Top,
  scale: { min: 0.65, max: 1 },
  fallback: CelebrationAnchorFallback.StageAnchor,
};

const MOBILE: CelebrationComposerAnchorPlacement = {
  ...DESKTOP,
  anchorRect: { x: 210, y: 132, width: 300, height: 56 },
  scale: { min: 0.77, max: 1 },
};

/* Where a stage point lands in the viewport under a mapping. */
const project = (
  mapping: ComposerAnchorMapping,
  x: number,
  y: number,
): [number, number] => [
  mapping.origin.x +
    (x - mapping.pivot.x) * mapping.scale * (mapping.isMirrored ? -1 : 1),
  mapping.origin.y + (y - mapping.pivot.y) * mapping.scale,
];

describe('resolveComposerAnchor', () => {
  let composer: HTMLDivElement;
  let viewportWidth: number;

  const setComposer = (rect: DOMRect) =>
    vi.spyOn(composer, 'getBoundingClientRect').mockReturnValue(rect);

  beforeEach(() => {
    viewportWidth = 1280;
    composer = document.createElement('div');
    composer.className = 'composer';
    document.body.append(composer);
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockImplementation(
      () => viewportWidth,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      900,
    );
    const original = window.getComputedStyle;
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = original(element);
      return {
        ...style,
        visibility: style.visibility || 'visible',
        direction: style.direction || 'ltr',
      } as CSSStyleDeclaration;
    });
  });

  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('keeps the authored size on a wide desktop composer and aligns its top edge and center', () => {
    setComposer(new DOMRect(190, 700, 900, 72));
    const mapping = resolveComposerAnchor(DESKTOP, 'composer', false);
    expect(mapping).toMatchObject({
      scale: 1,
      pivot: { x: 600, y: 164 },
      origin: { x: 640, y: 700 },
    });
    expect(mapping?.source?.element).toBe(composer);
    if (!mapping) return;
    expect(project(mapping, 340, 164)).toEqual([380, 700]);
  });

  it('scales a narrow phone composer uniformly on both axes', () => {
    viewportWidth = 360;
    setComposer(new DOMRect(45, 600, 270, 56));
    const mapping = resolveComposerAnchor(MOBILE, 'composer', false);
    expect(mapping?.scale).toBeCloseTo(0.9);
    if (!mapping) return;
    const [left] = project(mapping, 210, 132);
    const [right] = project(mapping, 510, 132);
    expect(right - left).toBeCloseTo(270);
  });

  it('caps the scale at its bounds', () => {
    viewportWidth = 1920;
    setComposer(new DOMRect(100, 700, 1700, 72));
    expect(resolveComposerAnchor(DESKTOP, 'composer', false)?.scale).toBe(1);
  });

  it('falls back to the synthetic anchor when the composer is narrower than the stage allows', () => {
    setComposer(new DOMRect(400, 700, 300, 72));
    const mapping = resolveComposerAnchor(DESKTOP, 'composer', false);
    expect(mapping?.source).toBeNull();
    expect(mapping?.scale).toBe(0.65);
    expect(mapping?.box.width).toBeCloseTo(338);
  });

  it('rejects a composer without room above it for the scaled stage', () => {
    setComposer(new DOMRect(190, 150, 900, 72));
    expect(
      resolveComposerAnchor(DESKTOP, 'composer', false)?.source,
    ).toBeNull();
  });

  it('places the synthetic anchor when the composer is missing', () => {
    composer.remove();
    const mapping = resolveComposerAnchor(DESKTOP, 'composer', false);
    expect(mapping?.box).toEqual({
      left: (1280 - 338) / 2,
      top: 900 * 0.57,
      width: 338,
      height: 56 * 0.65,
    });
  });

  it('returns no mapping for the poster fallback when no composer qualifies', () => {
    composer.remove();
    expect(
      resolveComposerAnchor(
        { ...DESKTOP, fallback: CelebrationAnchorFallback.Poster },
        'composer',
        false,
      ),
    ).toBeUndefined();
  });

  describe('with edge: bottom', () => {
    const BOTTOM = { ...DESKTOP, edge: CelebrationAnchorEdge.Bottom };

    it('aligns the anchor bottom with the composer bottom', () => {
      setComposer(new DOMRect(190, 700, 900, 72));
      const mapping = resolveComposerAnchor(BOTTOM, 'composer', false);
      expect(mapping).toMatchObject({
        pivot: { x: 600, y: 220 },
        origin: { x: 640, y: 772 },
      });
    });

    it('rejects a short composer whose stage would leave the viewport top', () => {
      /* Stage top = 170 + 40 - (164 + 56) = -10. */
      setComposer(new DOMRect(190, 170, 900, 40));
      expect(
        resolveComposerAnchor(BOTTOM, 'composer', false)?.source,
      ).toBeNull();
    });

    it('accepts a tall composer with less room above it', () => {
      /* Stage top = 110 + 120 - 220 = 10. */
      setComposer(new DOMRect(190, 110, 900, 120));
      expect(
        resolveComposerAnchor(BOTTOM, 'composer', false)?.source?.element,
      ).toBe(composer);
    });
  });

  it('keeps the anchor center on the composer center when mirrored', () => {
    setComposer(new DOMRect(250, 700, 900, 72));
    const mapping = resolveComposerAnchor(DESKTOP, 'composer', true);
    if (!mapping) throw new Error('No mapping');
    expect(project(mapping, 600, 164)).toEqual([700, 700]);
    expect(project(mapping, 340, 164)[0]).toBeGreaterThan(700);
  });
});

describe('resolveSyntheticAnchorBox', () => {
  it('returns nothing when the viewport is narrower than the anchor plus margins', () => {
    expect(resolveSyntheticAnchorBox(DESKTOP, 350, 900)).toBeUndefined();
  });

  it('keeps the headroom and the bottom margin free', () => {
    const box = resolveSyntheticAnchorBox(DESKTOP, 1280, 150);
    expect(box).toBeUndefined();
    const short = resolveSyntheticAnchorBox(MOBILE, 360, 260);
    expect(short?.top).toBeGreaterThanOrEqual(132 * 0.77);
    expect((short?.top ?? 0) + (short?.height ?? 0)).toBeLessThanOrEqual(
      260 - 26,
    );
  });
});

describe('rebaseStageOntoViewport', () => {
  const mapping: ComposerAnchorMapping = {
    scale: 0.9,
    box: { left: 100, top: 500, width: 468, height: 50 },
    source: null,
    pivot: { x: 600, y: 164 },
    origin: { x: 334, y: 500 },
    isMirrored: true,
    viewportWidth: 1024,
    viewportHeight: 768,
  };
  const composition = (): LottieComposition => ({
    w: 1200,
    h: 280,
    ip: 0,
    op: 960,
    layers: [
      { ty: 4, ind: 2, nm: 'helper', parent: 3, shapes: [] },
      { ty: 3, ind: 3, nm: 'rig' },
      { ty: 4, ind: 5, nm: 'master', shapes: [] },
    ],
  });

  it('sizes the root to the viewport and hangs every free top-level layer from one null layer', () => {
    const rebased = rebaseStageOntoViewport(composition(), mapping);
    expect([rebased.w, rebased.h]).toEqual([1024, 768]);
    const anchor = rebased.layers.at(-1);
    expect(anchor).toMatchObject({
      ty: 3,
      ind: 6,
      nm: COMPOSER_ANCHOR_LAYER_NAME,
      ip: 0,
      op: 960,
      ks: {
        a: { a: 0, k: [600, 164, 0] },
        p: { a: 0, k: [334, 500, 0] },
        s: { a: 0, k: [-90, 90, 100] },
      },
    });
    expect(rebased.layers.map(({ parent }) => parent)).toEqual([
      3,
      6,
      6,
      undefined,
    ]);
  });

  it('leaves the source object unchanged', () => {
    const source = composition();
    const before = JSON.stringify(source);
    rebaseStageOntoViewport(source, mapping);
    expect(JSON.stringify(source)).toBe(before);
  });

  it('rejects data without layers', () => {
    expect(() => rebaseStageOntoViewport({ w: 1, h: 1 }, mapping)).toThrow(
      TypeError,
    );
  });
});

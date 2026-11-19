import { describe, expect, it } from 'vitest';
import type {
  LottieComposition,
  LottieShape,
} from '../../models/lottie-composition';
import { buildGiftWrappingComposition } from '../../new-year/utils/gift-wrapping-composition';
import type { ComposerAnchorMapping } from '../composer-anchor';
import { fitComposerOutline } from '../composer-outline-adapter';
import fixture from './fixtures/composer-outline.lottie.json';

const load = (): LottieComposition =>
  JSON.parse(JSON.stringify(fixture)) as LottieComposition;

const mappingFor = (
  box: ComposerAnchorMapping['box'],
  overrides: Partial<ComposerAnchorMapping> = {},
): ComposerAnchorMapping => ({
  scale: 1,
  box,
  source: {
    element: document.createElement('div'),
    rect: new DOMRect(box.left, box.top, box.width, box.height),
  },
  pivot: { x: 600, y: 164 },
  origin: { x: box.left + box.width / 2, y: box.top },
  isMirrored: false,
  viewportWidth: 1440,
  viewportHeight: 900,
  ...overrides,
});

const findShape = (
  shapes: LottieShape[] | undefined,
  ty: string,
): LottieShape | undefined => {
  for (const shape of shapes ?? []) {
    if (shape.ty === ty) return shape;
    const nested = findShape(shape.it, ty);
    if (nested) return nested;
  }
  return undefined;
};

const layerNamed = (composition: LottieComposition, name: string) =>
  composition.layers.find((layer) => layer.nm === name);

const outlineVertices = (composition: LottieComposition) =>
  (
    findShape(layerNamed(composition, 'composer-outline')?.shapes, 'sh')?.ks
      ?.k as { v: number[][] }
  ).v;

/* Maps a stage point into the viewport under an unmirrored mapping. */
const toViewport = (mapping: ComposerAnchorMapping, [x, y]: number[]) => [
  mapping.origin.x + (x - mapping.pivot.x) * mapping.scale,
  mapping.origin.y + (y - mapping.pivot.y) * mapping.scale,
];

describe('fitComposerOutline', () => {
  it('traces a tall composer while other layers keep their authored geometry', () => {
    const composition = load();
    const helperBefore = JSON.stringify(layerNamed(composition, 'helper'));
    const mapping = mappingFor({
      left: 270,
      top: 600,
      width: 900,
      height: 140,
    });
    fitComposerOutline(composition, mapping);
    const viewport = outlineVertices(composition).map((point) =>
      toViewport(mapping, point),
    );
    const xs = viewport.map(([x]) => x);
    const ys = viewport.map(([, y]) => y);
    expect(Math.min(...xs)).toBeCloseTo(273);
    expect(Math.max(...xs)).toBeCloseTo(1167);
    expect(Math.min(...ys)).toBeCloseTo(599);
    expect(Math.max(...ys)).toBeCloseTo(737);
    expect(viewport[0]).toEqual([720, 599]);
    expect(JSON.stringify(layerNamed(composition, 'helper'))).toBe(
      helperBefore,
    );
  });

  it('keeps the contour within 4 CSS px of the composer at a reduced scale', () => {
    const composition = load();
    const mapping = mappingFor(
      { left: 45, top: 600, width: 270, height: 56 },
      { scale: 0.9, pivot: { x: 360, y: 132 } },
    );
    fitComposerOutline(composition, mapping);
    const xs = outlineVertices(composition).map(
      (point) => toViewport(mapping, point)[0],
    );
    expect(45 - Math.min(...xs)).toBeLessThanOrEqual(0);
    expect(Math.min(...xs) - 45).toBeLessThanOrEqual(4);
    expect(315 - Math.max(...xs)).toBeLessThanOrEqual(4);
  });

  it('removes the parcel when a real composer is measured', () => {
    const composition = load();
    fitComposerOutline(
      composition,
      mappingFor({ left: 270, top: 600, width: 900, height: 72 }),
    );
    expect(layerNamed(composition, 'composer-parcel')).toBeUndefined();
  });

  it('sizes the parcel to a synthetic anchor', () => {
    const composition = load();
    const box = { left: 471, top: 513, width: 338, height: 36.4 };
    fitComposerOutline(composition, {
      ...mappingFor(box, { scale: 0.65 }),
      source: null,
    });
    const rect = findShape(
      layerNamed(composition, 'composer-parcel')?.shapes,
      'rc',
    );
    const [width, height] = (rect?.s as { k: number[] }).k;
    expect(width).toBeCloseTo(520);
    expect(height).toBeCloseTo(56);
    const [x, y] = (rect?.p as { k: number[] }).k;
    expect(x).toBeCloseTo(600);
    expect(y).toBeCloseTo(192);
  });

  it.each([
    [
      'missing',
      (c: LottieComposition) => {
        c.layers = c.layers.filter(({ nm }) => nm !== 'composer-outline');
      },
    ],
    [
      'duplicated',
      (c: LottieComposition) => {
        c.layers.push(JSON.parse(JSON.stringify(c.layers[1])));
      },
    ],
    [
      'animated',
      (c: LottieComposition) => {
        const path = findShape(c.layers[1].shapes, 'sh');
        if (path) path.ks = { a: 1, k: [] };
      },
    ],
    [
      'transformed',
      (c: LottieComposition) => {
        const ks = c.layers[1].ks;
        if (ks) ks.p = { a: 0, k: [10, 0] };
      },
    ],
    [
      'inside a scaled group',
      (c: LottieComposition) => {
        const group = c.layers[1].shapes?.[0];
        const tr = group?.it?.find(({ ty }) => ty === 'tr');
        if (tr) tr.s = { a: 0, k: [50, 50] };
      },
    ],
  ])('rejects an outline slot that is %s', (_name, breakSlot) => {
    const composition = load();
    breakSlot(composition);
    expect(() =>
      fitComposerOutline(
        composition,
        mappingFor({ left: 270, top: 600, width: 900, height: 72 }),
      ),
    ).toThrow(TypeError);
  });

  it('rejects two parcel slots', () => {
    const composition = load();
    composition.layers.push(JSON.parse(JSON.stringify(composition.layers[2])));
    expect(() =>
      fitComposerOutline(
        composition,
        mappingFor({ left: 270, top: 600, width: 900, height: 72 }),
      ),
    ).toThrow(TypeError);
  });
});

describe('fitComposerOutline parity with the compiled scene', () => {
  it.each([
    { name: 'desktop', width: 520, isMobile: false, pivotX: 600, pivotY: 164 },
    { name: 'mobile', width: 300, isMobile: true, pivotX: 360, pivotY: 132 },
  ])(
    'draws the compiled ribbon contour at the $name reference geometry',
    ({ width, isMobile, pivotX, pivotY }) => {
      const box = { left: 200, top: 600, width, height: 56 };
      const compiled = buildGiftWrappingComposition(
        {
          width: 1440,
          height: 900,
          rtl: false,
          box,
          source: {
            element: document.createElement('div'),
            rect: new DOMRect(box.left, box.top, box.width, box.height),
          },
        },
        isMobile,
      ).animationData as unknown as LottieComposition;
      const ribbon = layerNamed(compiled, 'composer-ribbon');
      const [layerX, layerY] = ribbon?.ks?.p?.k as number[];
      const expected = (
        findShape(ribbon?.shapes, 'sh')?.ks?.k as { v: number[][] }
      ).v.map(([x, y]) => [layerX + x, layerY + y]);

      const composition = load();
      const mapping = mappingFor(box, { pivot: { x: pivotX, y: pivotY } });
      fitComposerOutline(composition, mapping);
      const actual = outlineVertices(composition).map((point) =>
        toViewport(mapping, point),
      );
      expect(actual).toHaveLength(expected.length);
      actual.forEach(([x, y], index) => {
        expect(x).toBeCloseTo(expected[index][0], 6);
        expect(y).toBeCloseTo(expected[index][1], 6);
      });
    },
  );
});

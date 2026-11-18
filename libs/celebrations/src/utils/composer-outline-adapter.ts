import type {
  LottieComposition,
  LottieLayer,
  LottieProperty,
  LottieShape,
  LottieTransform,
} from '../models/lottie-composition';
import { ComposerOutlineSlot } from '../types/composer-outline';
import type { ComposerAnchorMapping } from './composer-anchor';

/* Contour geometry around the anchor box, in stage units (today's `wrapPath`). */
const INSET = 3;
const CHAMFER = 10;
const FLOOR_OFFSET = 6;
const TOP_OFFSET = 5;
const CORNER_DROP = 15;

const isStatic = (property: LottieProperty | undefined) =>
  property == null || property.a === 0;

const isStaticValue = (
  property: LottieProperty | undefined,
  expected: number[],
) => {
  if (property == null) return true;
  if (property.a !== 0) return false;
  const value = Array.isArray(property.k) ? property.k : [property.k];
  return expected.every((number, index) => (value[index] ?? 0) === number);
};

/* Geometry may only come from the slot's own shape: no offset, scale, rotation or skew above it. */
const isIdentity = (transform: LottieTransform | undefined) =>
  transform == null ||
  (isStaticValue(transform.a, [0, 0]) &&
    isStaticValue(transform.p, [0, 0]) &&
    isStaticValue(transform.s, [100, 100]) &&
    isStaticValue(transform.r, [0]) &&
    isStaticValue(transform.sk, [0]));

/* Returns every item of type `ty` under `shapes`, or `undefined` when a group on the way has a non-identity transform. */
const collect = (
  shapes: LottieShape[] | undefined,
  ty: string,
): LottieShape[] | undefined => {
  const found: LottieShape[] = [];
  for (const shape of shapes ?? []) {
    if (shape.ty === ty) found.push(shape);
    if (shape.ty === 'tr' && !isIdentity(shape)) return undefined;
    if (shape.ty === 'gr') {
      const nested = collect(shape.it, ty);
      if (!nested) return undefined;
      found.push(...nested);
    }
  }
  return found;
};

const findSlotLayers = (composition: LottieComposition, slot: string) =>
  composition.layers.filter((layer) => layer.nm === slot);

const slotShape = (layer: LottieLayer, ty: string, slot: string) => {
  if (layer.ty !== 4 || !isIdentity(layer.ks))
    throw new TypeError(`${slot} needs an identity shape layer`);
  const shapes = collect(layer.shapes, ty);
  if (!shapes || shapes.length !== 1)
    throw new TypeError(
      `${slot} needs exactly one ${ty} under identity groups`,
    );
  return shapes[0];
};

/* The anchor box in stage units. */
interface StageBox {
  centerX: number;
  top: number;
  width: number;
  height: number;
}

const toStageBox = ({
  box,
  origin,
  pivot,
  scale,
}: ComposerAnchorMapping): StageBox => ({
  centerX: pivot.x,
  top: pivot.y + (box.top - origin.y) / scale,
  width: box.width / scale,
  height: box.height / scale,
});

/* The ribbon contour around `box`: starts at the top center and runs toward +x. */
const buildComposerOutlinePath = ({
  centerX,
  top,
  width,
  height,
}: StageBox) => {
  const floor = top - FLOOR_OFFSET;
  const right = width / 2 - INSET;
  const left = -right;
  const bottom = height + INSET;
  const vertices = [
    [0, TOP_OFFSET],
    [right - CHAMFER, TOP_OFFSET],
    [right, CORNER_DROP],
    [right, bottom - CHAMFER],
    [right - CHAMFER, bottom],
    [left + CHAMFER, bottom],
    [left, bottom - CHAMFER],
    [left, CORNER_DROP],
    [left + CHAMFER, TOP_OFFSET],
    [0, TOP_OFFSET],
  ].map(([x, y]) => [centerX + x, floor + y]);
  return {
    v: vertices,
    i: vertices.map(() => [0, 0]),
    o: vertices.map(() => [0, 0]),
    c: false,
  };
};

/**
 * Fits the outline and parcel slots of `composition` to the mapped anchor in
 * place; throws when a slot is missing, duplicated or not static.
 */
export const fitComposerOutline = (
  composition: LottieComposition,
  mapping: ComposerAnchorMapping,
): void => {
  const outlines = findSlotLayers(composition, ComposerOutlineSlot.Outline);
  if (outlines.length !== 1)
    throw new TypeError(`Expected one ${ComposerOutlineSlot.Outline} layer`);
  const parcels = findSlotLayers(composition, ComposerOutlineSlot.Parcel);
  if (parcels.length > 1)
    throw new TypeError(
      `Expected at most one ${ComposerOutlineSlot.Parcel} layer`,
    );

  const path = slotShape(outlines[0], 'sh', ComposerOutlineSlot.Outline);
  if (!isStatic(path.ks))
    throw new TypeError(`${ComposerOutlineSlot.Outline} path is animated`);
  const parcel = parcels[0]
    ? slotShape(parcels[0], 'rc', ComposerOutlineSlot.Parcel)
    : undefined;
  if (
    parcel &&
    (!isStatic(parcel.p as LottieProperty) ||
      !isStatic(parcel.s as LottieProperty))
  )
    throw new TypeError(`${ComposerOutlineSlot.Parcel} rectangle is animated`);

  const box = toStageBox(mapping);
  path.ks = { a: 0, k: buildComposerOutlinePath(box) };
  if (!parcel) return;
  if (mapping.source) {
    composition.layers = composition.layers.filter(
      (layer) => layer !== parcels[0],
    );
    return;
  }
  parcel.p = { a: 0, k: [box.centerX, box.top + box.height / 2] };
  parcel.s = { a: 0, k: [box.width, box.height] };
};

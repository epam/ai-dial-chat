import type { CelebrationComposerAnchorPlacement } from '../models/celebration-pack';
import type { ComposerCarryPreparation } from '../models/composer-carry';
import type {
  LottieComposition,
  LottieLayer,
  LottieProperty,
} from '../models/lottie-composition';
import type {
  LottieAnimationContext,
  LottiePlaybackStartContext,
} from '../models/lottie-scene';
import { CelebrationAnchorEdge } from '../types/celebration-pack';
import { PackSceneCompanionKind } from '../types/pack-scene';
import {
  prepareAnchoredSceneData,
  type PackScenePreparation,
} from './celebration-pack-scene';
import {
  prepareCelebrationSnapshots,
  SNAPSHOT_HIDE_FADE_SHARE,
} from './celebration-snapshots';
import { copyTrackKeyframes } from './lottie-track-keyframes';

/** Whole-composer copying is deliberately tighter than the generic snapshot ceiling. */
export const MAX_COMPOSER_CARRY_NODES = 300;

const CARRY_SLOT = 'composer-carry';
const DECORATION_SLOT = 'composer-decoration';
const SIDE_SLOT = 'composer-side';
const REFERENCE_WIDTH = 520;
const TRAVEL_RANGE = 1000;
const EXIT_MARGIN = 32;
const BOTTOM_MARGIN = 20;
const MAX_TRAVEL_KEYS = 64;

interface PositionKeyframe {
  t: number;
  s: number[];
  [key: string]: unknown;
}

const malformed: (reason: string) => never = (reason) => {
  throw new TypeError(`Malformed composer carry: ${reason}`);
};

const isStaticValue = (
  property: LottieProperty | undefined,
  expected: number[],
) => {
  if (property == null) return true;
  const values = Array.isArray(property.k) ? property.k : [property.k];
  return (
    property.a === 0 &&
    expected.every((value, index) => values[index] === value)
  );
};

const requireNull = (layers: LottieLayer[], name: string): LottieLayer => {
  const matches = layers.filter((layer) => layer.nm === name);
  if (matches.length !== 1 || matches[0].ty !== 3)
    malformed(`expected one null "${name}"`);
  const layer = matches[0];
  if (
    !Number.isInteger(layer.ind) ||
    !isStaticValue(layer.ks?.a, [0, 0, 0]) ||
    !isStaticValue(layer.ks?.s, [100, 100, 100]) ||
    !isStaticValue(layer.ks?.r, [0]) ||
    !isStaticValue(layer.ks?.sk, [0]) ||
    (layer.ao != null && layer.ao !== 0) ||
    (layer.st != null && layer.st !== 0) ||
    (layer.sr != null && layer.sr !== 1) ||
    layer.tm != null
  )
    malformed(`"${name}" must have an identity transform`);
  return layer;
};

const isFiniteCurve = (value: unknown): boolean => {
  if (typeof value !== 'object' || value == null) return false;
  const curve = value as { x?: unknown; y?: unknown };
  const x = Array.isArray(curve.x) ? curve.x : [curve.x];
  const y = Array.isArray(curve.y) ? curve.y : [curve.y];
  return (
    x.length > 0 &&
    y.length > 0 &&
    x.every(
      (value) =>
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1,
    ) &&
    y.every((value) => typeof value === 'number' && Number.isFinite(value))
  );
};

const travelKeys = (layer: LottieLayer, end: number): PositionKeyframe[] => {
  const position = layer.ks?.p;
  if (position?.a !== 1 || !Array.isArray(position.k))
    return malformed('carry position must be keyframed');
  const keys = position.k as PositionKeyframe[];
  if (keys.length < 2 || keys.length > MAX_TRAVEL_KEYS)
    malformed('carry position has an invalid key count');
  keys.forEach((key, index) => {
    if (
      !key ||
      !Number.isFinite(key.t) ||
      key.t < 0 ||
      key.t > end ||
      (index > 0 && key.t <= keys[index - 1].t) ||
      !Array.isArray(key.s) ||
      key.s.length !== 3 ||
      !key.s.every(Number.isFinite) ||
      key.s[0] < 0 ||
      key.s[0] > TRAVEL_RANGE ||
      key.s[1] !== 0 ||
      key.s[2] !== 0 ||
      (key.h != null && key.h !== 0 && key.h !== 1) ||
      'e' in key ||
      (key.to != null && JSON.stringify(key.to) !== '[0,0,0]') ||
      (key.ti != null && JSON.stringify(key.ti) !== '[0,0,0]')
    )
      malformed('carry position must be a finite horizontal track');
    if (
      (key.o != null || key.i != null) &&
      (!isFiniteCurve(key.o) || !isFiniteCurve(key.i))
    )
      malformed('carry easing must be finite cubic curves');
  });
  if (
    keys[0].t !== 0 ||
    keys[0].s[0] !== 0 ||
    keys.at(-1)?.t !== end ||
    keys.at(-1)?.s[0] !== 0
  )
    malformed('carry track must start and end at rest');
  return keys;
};

const fitComposerSide = (
  composition: LottieComposition,
  carry: LottieLayer,
  width: number,
  height: number,
): number | undefined => {
  if (!composition.layers.some((layer) => layer.nm === SIDE_SLOT)) return;
  const side = requireNull(composition.layers, SIDE_SLOT);
  if (side.parent !== carry.ind || !isStaticValue(side.ks?.o, [100]))
    malformed('side slot must be an opaque direct child of the carrier');
  const position = side.ks?.p;
  const mapPosition = (value: unknown): number[] => {
    if (
      !Array.isArray(value) ||
      value.length !== 3 ||
      !value.every(Number.isFinite) ||
      value[0] < -1 ||
      value[0] > 1 ||
      value[1] < 0 ||
      value[1] > 1 ||
      value[2] !== 0
    )
      return malformed('side position must stay within the composer bounds');
    return [(value[0] * width) / 2, value[1] * height, 0];
  };
  if (position?.a === 0) {
    const fitted = mapPosition(position.k);
    side.ks = { ...side.ks, p: { a: 0, k: fitted } };
    return fitted[1];
  }
  if (
    position?.a !== 1 ||
    !Array.isArray(position.k) ||
    position.k.length === 0 ||
    position.k.length > MAX_TRAVEL_KEYS
  )
    return malformed('side position must be static or have a bounded track');
  const keys = position.k as PositionKeyframe[];
  let lowestAttachment = 0;
  side.ks = {
    ...side.ks,
    p: {
      a: 1,
      k: keys.map((key, index) => {
        if (
          !key ||
          !Number.isFinite(key.t) ||
          key.t < 0 ||
          key.t > composition.op ||
          (index > 0 && key.t <= keys[index - 1].t) ||
          (key.h != null && key.h !== 0 && key.h !== 1) ||
          'e' in key ||
          (key.to != null && JSON.stringify(key.to) !== '[0,0,0]') ||
          (key.ti != null && JSON.stringify(key.ti) !== '[0,0,0]')
        )
          malformed('side position has an invalid keyframe');
        if (
          (key.o != null || key.i != null) &&
          (!isFiniteCurve(key.o) || !isFiniteCurve(key.i))
        )
          malformed('side easing must be finite cubic curves');
        const fitted = mapPosition(key.s);
        lowestAttachment = Math.max(lowestAttachment, fitted[1]);
        return { ...key, s: fitted };
      }),
    },
  };
  return lowestAttachment;
};

/** Maps authored travel, side contacts and decoration width, and prepares one inert composer copy. */
export const prepareComposerCarryScene = (
  data: unknown,
  placement: CelebrationComposerAnchorPlacement,
  composerClass: string | undefined,
): PackScenePreparation => {
  if (placement.edge !== CelebrationAnchorEdge.Top)
    malformed('carry needs the composer top edge');
  const preparation = prepareAnchoredSceneData(
    data,
    placement,
    composerClass,
    false,
    false,
  );
  const anchor = preparation.anchor;
  const source = anchor?.source;
  if (!anchor || !source) throw new Error('No eligible composer to carry');
  const { element } = source;
  if (
    element.getElementsByTagName('*').length + 1 > MAX_COMPOSER_CARRY_NODES ||
    !element.querySelector('textarea:not(:disabled)') ||
    element.querySelector('[aria-haspopup][aria-expanded="true"]')
  )
    throw new Error('Composer cannot be safely copied');
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    const style = getComputedStyle(node);
    const hasTransform = ['transform', 'translate', 'rotate', 'scale'].some(
      (name) => {
        const value = style.getPropertyValue(name);
        return value !== '' && value !== 'none';
      },
    );
    const zoom = style.getPropertyValue('zoom');
    if (hasTransform || (zoom && zoom !== '1' && zoom !== 'normal'))
      throw new Error('A transformed composer cannot be copied');
  }
  const composition = preparation.data as LottieComposition;
  const frameRate = Number(composition.fr);
  const durationMs = (composition.op / frameRate) * 1000;
  if (
    composition.ip !== 0 ||
    !Number.isFinite(frameRate) ||
    frameRate <= 0 ||
    !Number.isFinite(durationMs) ||
    durationMs <= 0 ||
    durationMs > 29750
  )
    malformed('invalid finite timeline');
  const carry = requireNull(composition.layers, CARRY_SLOT);
  const decoration = requireNull(composition.layers, DECORATION_SLOT);
  const anchorLayer = composition.layers.at(-1);
  const sourceCarry = (data as LottieComposition).layers.find(
    (layer) => layer.nm === CARRY_SLOT,
  );
  if (
    sourceCarry?.parent != null ||
    carry.parent !== anchorLayer?.ind ||
    decoration.parent !== carry.ind ||
    !isStaticValue(carry.ks?.o, [100]) ||
    !isStaticValue(decoration.ks?.p, [0, 0, 0])
  )
    malformed('invalid carrier or decoration hierarchy');
  const byIndex = new Map(
    composition.layers.map((layer) => [layer.ind, layer]),
  );
  if (byIndex.size !== composition.layers.length)
    malformed('duplicate layer index');
  for (const layer of composition.layers) {
    if (layer === carry || layer === anchorLayer) continue;
    let current: LottieLayer | undefined = layer;
    for (
      let depth = 0;
      current && current !== carry && depth < composition.layers.length;
      depth++
    )
      current = byIndex.get(current.parent);
    if (current !== carry)
      malformed('all artwork must descend from the carrier');
  }
  const keys = travelKeys(carry, composition.op);
  const lowestAttachment = fitComposerSide(
    composition,
    carry,
    source.rect.width / anchor.scale,
    source.rect.height / anchor.scale,
  );
  if (lowestAttachment !== undefined) {
    /* The stage tail declares the art extent below any side attachment. */
    const belowAttachment =
      (data as LottieComposition).h - placement.anchorRect.y;
    if (belowAttachment < 0)
      malformed('side artwork has no declared lower extent');
    const bottom =
      source.rect.top + (lowestAttachment + belowAttachment) * anchor.scale;
    if (bottom > anchor.viewportHeight - BOTTOM_MARGIN)
      throw new Error('No viewport room below the composer side artwork');
  }
  const travel =
    (anchor.viewportWidth - source.rect.left + EXIT_MARGIN) / anchor.scale;
  carry.ks = {
    ...carry.ks,
    p: {
      a: 1,
      k: keys.map((key) => ({
        ...key,
        s: [
          anchor.pivot.x + (key.s[0] / TRAVEL_RANGE) * travel,
          anchor.pivot.y,
          0,
        ],
      })),
    },
  };
  decoration.ks = {
    ...decoration.ks,
    s: {
      a: 0,
      k: [
        (source.rect.width / (REFERENCE_WIDTH * anchor.scale)) * 100,
        100,
        100,
      ],
    },
  };
  const { keyframes } = copyTrackKeyframes(carry, {
    durationMs,
    toCompositionMs: (frame) => (frame / frameRate) * 1000,
    releaseFrame: composition.op,
    mirror: 1,
    scale: anchor.scale,
  });
  const handlers: ComposerCarryPreparation['handlers'] = {};
  const copy = prepareCelebrationSnapshots([source], {
    durationMs,
    hideAt: SNAPSHOT_HIDE_FADE_SHARE,
    restoreAt: 1,
    restoreShare: 0,
    frames: () => keyframes,
    onStop: () => handlers.onStop?.(),
  });
  return {
    ...preparation,
    companion: { kind: PackSceneCompanionKind.ComposerCarry, copy, handlers },
  };
};

/** Attaches the prepared copy below the art; every termination releases both. */
export const onComposerCarryAnimationCreated = ({
  preparation,
  host,
  addDisposer,
  cancel,
}: LottieAnimationContext<PackScenePreparation>): void => {
  const carry = preparation.companion;
  if (carry?.kind !== PackSceneCompanionKind.ComposerCarry) return;
  const layer = document.createElement('div');
  layer.dataset.composerCarry = 'true';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
  });
  addDisposer(() => {
    carry.handlers.onStop = undefined;
    carry.copy.stop();
    layer.remove();
  });
  host.prepend(layer);
  carry.copy.attach(layer);
  carry.handlers.onStop = cancel;
};

/** Starts the copy and original opacity on the first rendered Lottie frame's clock. */
export const onComposerCarryPlaybackStarted = ({
  preparation,
  timelineZeroMs,
}: LottiePlaybackStartContext<PackScenePreparation>): void => {
  if (preparation.companion?.kind === PackSceneCompanionKind.ComposerCarry)
    preparation.companion.copy.start(timelineZeroMs);
};

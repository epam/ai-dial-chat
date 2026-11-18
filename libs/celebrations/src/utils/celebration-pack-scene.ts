import { SUPPORTED_CELEBRATION_CAPABILITIES } from '../constants/celebration-capabilities';
import type {
  CelebrationComposerAnchorPlacement,
  CelebrationPlacementDescriptor,
  CelebrationSceneDescriptor,
  CelebrationSceneVariantDescriptor,
  CelebrationStageAlignment,
  CelebrationTextDirection,
} from '../models/celebration-pack';
import {
  CelebrationCapability,
  CelebrationPlacementTemplate,
  CelebrationStageEdge,
} from '../types/celebration-pack';
import {
  rebaseStageOntoViewport,
  resolveComposerAnchor,
  type ComposerAnchorMapping,
} from './composer-anchor';
import { fitComposerOutline } from './composer-outline-adapter';

/** Most SVG elements a generated pack renderer may hold before it counts as a failure. */
export const MAX_PACK_SCENE_ELEMENTS = 800;

/** A pack animation ready for the player, with its stage width-to-height ratio. */
export interface PackScenePreparation {
  /** The validated Lottie JSON; for an anchored scene, a private re-based copy. */
  data: object;
  /** Composition width divided by its height. */
  aspectRatio: number;
  /** How an anchored stage maps onto the viewport; absent for a viewport stage. */
  anchor?: ComposerAnchorMapping;
}

/** Whether this release can play the scene's renderer, capabilities and placement. */
export const isCelebrationSceneSupported = (
  scene: CelebrationSceneDescriptor,
): boolean => {
  const { template } = scene.placement;
  const isAnchored = template === CelebrationPlacementTemplate.ComposerAnchorV1;
  return (
    scene.renderer === CelebrationCapability.LottieLightSvgV1 &&
    (isAnchored || template === CelebrationPlacementTemplate.ViewportStageV1) &&
    (isAnchored || !requiresComposerOutline(scene)) &&
    scene.requiredCapabilities.every((capability) =>
      SUPPORTED_CELEBRATION_CAPABILITIES.has(capability),
    )
  );
};

/** Returns the variant's placement, else the scene's; `undefined` when the variant changes the template. */
export const resolveVariantPlacement = (
  scene: CelebrationSceneDescriptor,
  variant: CelebrationSceneVariantDescriptor,
): CelebrationPlacementDescriptor | undefined => {
  const placement = variant.placement ?? scene.placement;
  return placement.template === scene.placement.template
    ? placement
    : undefined;
};

/** Whether the scene asks for the `interaction-composer-outline-v1` adapter. */
export const requiresComposerOutline = (
  scene: CelebrationSceneDescriptor,
): boolean =>
  scene.requiredCapabilities.includes(
    CelebrationCapability.InteractionComposerOutlineV1,
  );

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Returns the preparation for loaded Lottie JSON; throws when it has no positive `w` and `h`. */
export const preparePackSceneData = (data: unknown): PackScenePreparation => {
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    throw new TypeError('Animation data is not an object');
  const { w, h } = data as { w?: unknown; h?: unknown };
  if (!isPositiveNumber(w) || !isPositiveNumber(h))
    throw new TypeError('Animation data has no stage size');
  return { data, aspectRatio: w / h };
};

/**
 * Returns a private copy of `data` mapped onto the measured composer, with the
 * outline slots fitted when `withOutline`; throws when the scene must show its poster.
 */
export const prepareAnchoredSceneData = (
  data: unknown,
  placement: CelebrationComposerAnchorPlacement,
  composerClass: string | undefined,
  isMirrored: boolean,
  withOutline: boolean,
): PackScenePreparation => {
  const { aspectRatio } = preparePackSceneData(data);
  const anchor = resolveComposerAnchor(placement, composerClass, isMirrored);
  if (!anchor) throw new Error('No composer and no stage anchor');
  const rebased = rebaseStageOntoViewport(data, anchor);
  if (withOutline) fitComposerOutline(rebased, anchor);
  return { data: rebased, aspectRatio, anchor };
};

/** Whether the rendered stage stays within the element budget. */
export const isPackRendererWithinBudget = (host: HTMLElement): boolean =>
  host.getElementsByTagName('*').length <= MAX_PACK_SCENE_ELEMENTS;

const BLOCK_POSITION: Record<CelebrationStageEdge, string> = {
  [CelebrationStageEdge.Start]: 'top',
  [CelebrationStageEdge.Center]: 'center',
  [CelebrationStageEdge.End]: 'bottom',
};

/** Returns the poster's `object-position`; the inline edge follows `direction`, inverted for a mirrored poster. */
export const resolvePosterObjectPosition = (
  alignment: CelebrationStageAlignment,
  direction: CelebrationTextDirection,
  isMirrored: boolean,
): string => {
  const isStartLeft = (direction === 'ltr') !== isMirrored;
  let inline = 'center';
  if (alignment.inline === CelebrationStageEdge.Start)
    inline = isStartLeft ? 'left' : 'right';
  else if (alignment.inline === CelebrationStageEdge.End)
    inline = isStartLeft ? 'right' : 'left';
  return `${inline} ${BLOCK_POSITION[alignment.block]}`;
};

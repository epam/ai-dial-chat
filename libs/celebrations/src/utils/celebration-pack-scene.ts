import { SUPPORTED_CELEBRATION_CAPABILITIES } from '../constants/celebration-capabilities';
import type {
  CelebrationSceneDescriptor,
  CelebrationStageAlignment,
  CelebrationTextDirection,
} from '../models/celebration-pack';
import {
  CelebrationCapability,
  CelebrationPlacementTemplate,
  CelebrationStageEdge,
} from '../types/celebration-pack';

/** Most SVG elements a generated pack renderer may hold before it counts as a failure. */
export const MAX_PACK_SCENE_ELEMENTS = 800;

/** A pack animation ready for the player, with its stage width-to-height ratio. */
export interface PackScenePreparation {
  /** The validated Lottie JSON. */
  data: object;
  /** Composition width divided by its height. */
  aspectRatio: number;
}

/** Whether this release can play the scene's renderer, capabilities and placement. */
export const isCelebrationSceneSupported = (
  scene: CelebrationSceneDescriptor,
): boolean =>
  scene.renderer === CelebrationCapability.LottieLightSvgV1 &&
  scene.placement.template === CelebrationPlacementTemplate.ViewportStageV1 &&
  scene.requiredCapabilities.every((capability) =>
    SUPPORTED_CELEBRATION_CAPABILITIES.has(capability),
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

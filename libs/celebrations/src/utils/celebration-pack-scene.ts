import { SUPPORTED_CELEBRATION_CAPABILITIES } from '../constants/celebration-capabilities';
import type { CatBorrowPreparation } from '../models/cat-borrow';
import type {
  CelebrationComposerAnchorPlacement,
  CelebrationPlacementDescriptor,
  CelebrationSceneDescriptor,
  CelebrationSceneVariantDescriptor,
  CelebrationStageAlignment,
  CelebrationTextDirection,
} from '../models/celebration-pack';
import type { ComposerCarryPreparation } from '../models/composer-carry';
import type { CopyTrackPreparation } from '../models/copy-track-preparation';
import type { HistoryLadderPreparation } from '../models/history-ladder';
import {
  CelebrationCapability,
  CelebrationDirectionMode,
  CelebrationPlacementTemplate,
  CelebrationStageEdge,
} from '../types/celebration-pack';
import { PackSceneCompanionKind } from '../types/pack-scene';
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
  /** Whether a generic interaction has mapped native units directly onto the viewport. */
  isViewportMapped?: boolean;
  /** The payload of the adapter that prepared the scene; each adapter reads only its own kind. */
  companion?: PackSceneCompanion;
}

/** An adapter's payload on a pack preparation, tagged with its kind. */
export type PackSceneCompanion =
  | ({ kind: PackSceneCompanionKind.CatBorrow } & CatBorrowPreparation)
  | ({ kind: PackSceneCompanionKind.CopyTrack } & CopyTrackPreparation)
  | ({ kind: PackSceneCompanionKind.ComposerCarry } & ComposerCarryPreparation)
  | ({ kind: PackSceneCompanionKind.HistoryLadder } & HistoryLadderPreparation);

/** Whether the scene asks for the `interaction-cat-borrow-v1` adapter. */
export const requiresCatBorrow = (scene: CelebrationSceneDescriptor): boolean =>
  scene.requiredCapabilities.includes(
    CelebrationCapability.InteractionCatBorrowV1,
  );

/** Whether the scene asks for the `interaction-copy-track-v1` adapter. */
export const requiresCopyTrack = (scene: CelebrationSceneDescriptor): boolean =>
  scene.requiredCapabilities.includes(
    CelebrationCapability.InteractionCopyTrackV1,
  );

/** Whether the scene asks to carry an inert copy of the whole composer. */
export const requiresComposerCarry = (
  scene: CelebrationSceneDescriptor,
): boolean =>
  scene.requiredCapabilities.includes(
    CelebrationCapability.InteractionComposerCarryV1,
  );

/** Whether the scene requires six measured history stations and one copy. */
export const requiresHistoryLadder = (
  scene: CelebrationSceneDescriptor,
): boolean =>
  scene.requiredCapabilities.includes(
    CelebrationCapability.InteractionHistoryLadderV1,
  );

/** Whether this release can play the scene's renderer, capabilities and placement. */
export const isCelebrationSceneSupported = (
  scene: CelebrationSceneDescriptor,
): boolean => {
  const { template } = scene.placement;
  const isAnchored = template === CelebrationPlacementTemplate.ComposerAnchorV1;
  const interactions = scene.requiredCapabilities.filter((capability) =>
    capability.startsWith('interaction-'),
  );
  const isCatBorrow = requiresCatBorrow(scene);
  const isCopyTrack = requiresCopyTrack(scene);
  const isComposerCarry = requiresComposerCarry(scene);
  const isHistoryLadder = requiresHistoryLadder(scene);
  return (
    scene.renderer === CelebrationCapability.LottieLightSvgV1 &&
    (isAnchored || template === CelebrationPlacementTemplate.ViewportStageV1) &&
    (isAnchored || interactions.length === 0 || isHistoryLadder) &&
    interactions.length <= 1 &&
    (!(isCatBorrow || isCopyTrack || isComposerCarry) ||
      scene.direction === CelebrationDirectionMode.None) &&
    (!isHistoryLadder ||
      (!isAnchored &&
        scene.direction === CelebrationDirectionMode.None &&
        scene.requiredCapabilities.includes(
          CelebrationCapability.ViewportStageV1,
        ) &&
        scene.variants.every(
          (variant) =>
            (variant.placement ?? scene.placement).template ===
            CelebrationPlacementTemplate.ViewportStageV1,
        ))) &&
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

import { CelebrationCapability } from '../types/celebration-pack';

/** Capability ids this release implements. */
export const SUPPORTED_CELEBRATION_CAPABILITIES: ReadonlySet<string> =
  new Set<string>([
    CelebrationCapability.LottieLightSvgV1,
    CelebrationCapability.ViewportStageV1,
    CelebrationCapability.ComposerAnchorV1,
    CelebrationCapability.InteractionComposerOutlineV1,
    CelebrationCapability.InteractionCatBorrowV1,
    CelebrationCapability.StaticPosterV1,
    CelebrationCapability.StaticTriggerV1,
  ]);

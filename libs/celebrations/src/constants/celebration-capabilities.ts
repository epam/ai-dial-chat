import { CelebrationCapability } from '../types/celebration-pack';

/** Capability ids this release implements; `composer-anchor-v1` is not among them. */
export const SUPPORTED_CELEBRATION_CAPABILITIES: ReadonlySet<string> =
  new Set<string>([
    CelebrationCapability.LottieLightSvgV1,
    CelebrationCapability.ViewportStageV1,
    CelebrationCapability.StaticPosterV1,
    CelebrationCapability.StaticTriggerV1,
  ]);

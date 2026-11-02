import type { CelebrationAnchors } from '../../models/celebration';
import { buildReindeerComposition } from './reindeer-composition';
import { getReindeerTargets } from './reindeer-targets';

/** A crowded page uses the static resolution instead of covering host content. */
export const prepareReindeerScene = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
) => {
  const targets = getReindeerTargets(anchors, isMobile);
  if (targets.isStatic) throw new Error('No clear reindeer stage');
  return buildReindeerComposition(targets, isMobile);
};

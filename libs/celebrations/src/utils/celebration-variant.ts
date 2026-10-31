import type {
  CelebrationSceneVariantDescriptor,
  CelebrationStageAlignment,
  CelebrationVariantInput,
} from '../models/celebration-pack';
import {
  CelebrationStageAlign,
  CelebrationStageEdge,
} from '../types/celebration-pack';

/* Counts the declared conditions a variant meets, or -1 when one contradicts the input. */
const countMatches = (
  variant: CelebrationSceneVariantDescriptor,
  input: CelebrationVariantInput,
): number => {
  const { layout, direction, colorScheme } = variant.when;
  const conditions: [unknown, unknown][] = [
    [layout, input.layout],
    [direction, input.direction],
    [colorScheme, input.colorScheme],
  ];
  let matches = 0;
  for (const [declared, actual] of conditions) {
    if (declared == null) continue;
    if (declared !== actual) return -1;
    matches += 1;
  }
  return matches;
};

/** Returns the variant meeting the most conditions, the earliest on a tie, or `undefined` when none applies. */
export const selectCelebrationVariant = (
  variants: readonly CelebrationSceneVariantDescriptor[],
  input: CelebrationVariantInput,
): CelebrationSceneVariantDescriptor | undefined => {
  let best: CelebrationSceneVariantDescriptor | undefined;
  let bestMatches = -1;
  for (const variant of variants) {
    const matches = countMatches(variant, input);
    if (matches > bestMatches) {
      best = variant;
      bestMatches = matches;
    }
  }
  return best;
};

const STAGE_ALIGNMENT: Record<
  CelebrationStageAlign,
  CelebrationStageAlignment
> = {
  [CelebrationStageAlign.Center]: {
    block: CelebrationStageEdge.Center,
    inline: CelebrationStageEdge.Center,
  },
  [CelebrationStageAlign.Top]: {
    block: CelebrationStageEdge.Start,
    inline: CelebrationStageEdge.Center,
  },
  [CelebrationStageAlign.Bottom]: {
    block: CelebrationStageEdge.End,
    inline: CelebrationStageEdge.Center,
  },
  [CelebrationStageAlign.TopStart]: {
    block: CelebrationStageEdge.Start,
    inline: CelebrationStageEdge.Start,
  },
  [CelebrationStageAlign.TopEnd]: {
    block: CelebrationStageEdge.Start,
    inline: CelebrationStageEdge.End,
  },
  [CelebrationStageAlign.BottomStart]: {
    block: CelebrationStageEdge.End,
    inline: CelebrationStageEdge.Start,
  },
  [CelebrationStageAlign.BottomEnd]: {
    block: CelebrationStageEdge.End,
    inline: CelebrationStageEdge.End,
  },
};

/** Returns the logical block and inline position of a stage; `start`/`end` follow the stage's own `dir`. */
export const resolveStageAlignment = (
  align: CelebrationStageAlign,
): CelebrationStageAlignment =>
  STAGE_ALIGNMENT[align] ?? STAGE_ALIGNMENT[CelebrationStageAlign.Center];

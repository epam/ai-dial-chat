import type { CelebrationAnchors } from '../../models/celebration';
import {
  measureComposer,
  type ComposerBox,
  type ComposerSource,
} from '../../utils/composer-target';

/** Measured stage and the single, read-only host anchor. */
export interface GiftWrappingTarget {
  width: number;
  height: number;
  rtl: boolean;
  box: ComposerBox;
  source: ComposerSource | null;
}

const MIN_COMPOSER_WIDTH = 230;

/** Returns a safe composer stage, or a small decorative parcel. */
export const getGiftWrappingTarget = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): GiftWrappingTarget => {
  const clearance = isMobile ? 132 : 164;
  const { width, height, rtl, composer } = measureComposer(anchors.composer, {
    minWidth: MIN_COMPOSER_WIDTH,
    headroom: clearance,
  });
  if (composer)
    return { width, height, rtl, box: composer.box, source: composer.source };
  const boxWidth = Math.min(isMobile ? 250 : 340, Math.max(80, width - 32));
  return {
    width,
    height,
    rtl,
    box: {
      left: (width - boxWidth) / 2,
      top: Math.min(
        Math.max(clearance, height * 0.57),
        Math.max(0, height - 92),
      ),
      width: boxWidth,
      height: 66,
    },
    source: null,
  };
};

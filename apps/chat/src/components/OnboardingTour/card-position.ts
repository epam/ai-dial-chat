export const VIEWPORT_MARGIN = 16;
export const TARGET_GAP = 12;

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

/**
 * Places the hint card next to its target: below when it fits, otherwise
 * above, otherwise beside the target on the side with more room. The card's
 * leading edge lines up with the target's leading edge — the left edge in
 * LTR, the right edge in RTL. The result is clamped into the viewport.
 */
export const computeCardPosition = (
  target: Box,
  card: Size,
  viewport: Size,
  isRtl: boolean,
): { top: number; left: number } => {
  const maxLeft = viewport.width - card.width - VIEWPORT_MARGIN;
  const maxTop = viewport.height - card.height - VIEWPORT_MARGIN;
  const clamp = (value: number, max: number) =>
    Math.max(VIEWPORT_MARGIN, Math.min(value, max));

  const alignedLeft = isRtl
    ? target.left + target.width - card.width
    : target.left;

  const below = target.top + target.height + TARGET_GAP;
  if (below + card.height + VIEWPORT_MARGIN <= viewport.height) {
    return { top: below, left: clamp(alignedLeft, maxLeft) };
  }

  const above = target.top - TARGET_GAP - card.height;
  if (above >= VIEWPORT_MARGIN) {
    return { top: above, left: clamp(alignedLeft, maxLeft) };
  }

  /* A tall target, such as the sidebar: put the card beside it. */
  const roomAfter = viewport.width - (target.left + target.width);
  const besideLeft =
    roomAfter >= target.left
      ? target.left + target.width + TARGET_GAP
      : target.left - TARGET_GAP - card.width;
  return {
    top: clamp(target.top, maxTop),
    left: clamp(besideLeft, maxLeft),
  };
};

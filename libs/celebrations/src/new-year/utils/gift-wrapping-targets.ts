import type { CelebrationAnchors } from '../../models/celebration';

/** Measured stage and the single, read-only host anchor. */
export interface GiftWrappingTarget {
  width: number;
  height: number;
  rtl: boolean;
  box: { left: number; top: number; width: number; height: number };
  source: { element: HTMLElement; rect: DOMRect } | null;
}

const EXCLUDED = '[hidden], [inert], [aria-hidden="true"]';

/** Returns a safe composer stage, or a small decorative parcel. */
export const getGiftWrappingTarget = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): GiftWrappingTarget => {
  const { clientWidth, clientHeight } = document.documentElement;
  const width = Math.max(1, clientWidth);
  const height = Math.max(1, clientHeight);
  const candidates = anchors.composer
    ? document.getElementsByClassName(anchors.composer)
    : [];
  const clearance = isMobile ? 132 : 164;
  let rtl = getComputedStyle(document.documentElement).direction === 'rtl';
  for (let i = 0; i < Math.min(candidates.length, 4); i++) {
    const element = candidates[i];
    if (!(element instanceof HTMLElement)) continue;
    const rect = element.getBoundingClientRect();
    rtl = getComputedStyle(element).direction === 'rtl';
    if (
      rect.width < 230 ||
      rect.height < 36 ||
      rect.height > 260 ||
      rect.left < 12 ||
      rect.right > width - 12 ||
      rect.top < clearance ||
      rect.bottom > height - 20
    )
      continue;
    let parent: HTMLElement | null = element;
    let eligible = true;
    for (let depth = 0; parent && depth < 24; depth++) {
      const style = getComputedStyle(parent);
      if (
        parent.matches(EXCLUDED) ||
        style.display === 'none' ||
        style.visibility !== 'visible' ||
        style.opacity === '0' ||
        style.contentVisibility === 'hidden'
      ) {
        eligible = false;
        break;
      }
      if (parent !== element) {
        const clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
        const clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
        if (clipX || clipY) {
          const clip = parent.getBoundingClientRect();
          if (
            (clipX && (rect.left < clip.left || rect.right > clip.right)) ||
            (clipY && (rect.top < clip.top || rect.bottom > clip.bottom))
          ) {
            eligible = false;
            break;
          }
        }
      }
      parent = parent.parentElement;
    }
    if (!eligible || parent) continue;
    return {
      width,
      height,
      rtl,
      box: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      source: { element, rect },
    };
  }
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

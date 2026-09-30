import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import { findWelcomeRegion } from '../../utils/host-anchors';

/** A bounded set of idle buttons and the measured stage around them. */
export interface WitchTargets {
  /** Viewport width in CSS pixels. */
  width: number;
  /** Viewport height in CSS pixels. */
  height: number;
  /** Composer geometry, never copied. */
  composer?: CelebrationSnapshotTarget;
  /** Safe small buttons, nearest to the stage first. */
  buttons: CelebrationSnapshotTarget[];
}

/** Maximum descendants copied from a single button. */
export const WITCH_NODE_LIMIT = 40;
/** Maximum number of candidate buttons inspected per activation. */
export const WITCH_SCAN_LIMIT = 24;

const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const UNSAFE =
  ':disabled, [aria-disabled="true"], [aria-expanded="true"], input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const CLIPPED = /^(auto|scroll|hidden|clip)$/;

/** Measure a small, safe selection once; never discover host classes or routes. */
export const getWitchTargets = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): WitchTargets => {
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const rects = new Map<HTMLElement, DOMRect>();
  const styles = new Map<HTMLElement, CSSStyleDeclaration>();
  const measure = (element: HTMLElement) => {
    let rect = rects.get(element);
    if (!rect) {
      rect = element.getBoundingClientRect();
      rects.set(element, rect);
    }
    return rect;
  };
  const visible = (
    element: HTMLElement,
  ): CelebrationSnapshotTarget | undefined => {
    if (element.closest(EXCLUDED)) return;
    const rect = measure(element);
    if (
      rect.width < 20 ||
      rect.height < 20 ||
      rect.left < 0 ||
      rect.top < 0 ||
      rect.right > width ||
      rect.bottom > height
    )
      return;
    let parent: HTMLElement | null = element;
    for (
      let depth = 0;
      parent && depth < 32;
      depth++, parent = parent.parentElement
    ) {
      let style = styles.get(parent);
      if (!style) {
        style = getComputedStyle(parent);
        styles.set(parent, style);
      }
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.opacity === '0' ||
        style.contentVisibility === 'hidden'
      )
        return;
      const clipsX = CLIPPED.test(style.overflowX || style.overflow);
      const clipsY = CLIPPED.test(style.overflowY || style.overflow);
      if (clipsX || clipsY) {
        const clip = measure(parent);
        if (
          (clipsX && (rect.left < clip.left || rect.right > clip.right)) ||
          (clipsY && (rect.top < clip.top || rect.bottom > clip.bottom))
        )
          return;
      }
    }
    return parent ? undefined : { element, rect };
  };
  const composers = anchors.composer
    ? document.getElementsByClassName(anchors.composer)
    : [];
  let composer: CelebrationSnapshotTarget | undefined;
  for (let i = 0; i < Math.min(4, composers.length); i++) {
    const element = composers[i];
    if (element instanceof HTMLElement) composer = visible(element);
    if (composer) break;
  }
  if (!composer) return { width, height, buttons: [] };
  const candidates = new Set<HTMLElement>();
  const take = (root: Element, limit: number) => {
    const buttons = root.getElementsByTagName('button');
    for (
      let i = 0;
      i < Math.min(limit, buttons.length) && candidates.size < WITCH_SCAN_LIMIT;
      i++
    )
      candidates.add(buttons[i]);
  };
  take(composer.element, 12);
  const region = findWelcomeRegion(composer.element, anchors);
  const lists = anchors.starterList
    ? region?.getElementsByClassName(anchors.starterList)
    : undefined;
  for (let i = 0; i < Math.min(2, lists?.length ?? 0); i++) {
    const list = lists?.[i];
    if (list) take(list, 12);
  }
  const buttons: CelebrationSnapshotTarget[] = [];
  for (const element of candidates) {
    /* Stop counting as soon as the copy budget is exceeded; large custom
       button subtrees must not turn eligibility into an unbounded walk. */
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
    let descendants = 0;
    while (descendants <= WITCH_NODE_LIMIT && walker.nextNode()) descendants++;
    if (
      descendants > WITCH_NODE_LIMIT ||
      element.contains(document.activeElement) ||
      element.closest(UNSAFE) ||
      element.querySelector(UNSAFE)
    )
      continue;
    const target = visible(element);
    if (
      target &&
      target.rect.width <= 240 &&
      target.rect.height <= 64 &&
      target.rect.width * target.rect.height <= 15360
    )
      buttons.push(target);
  }
  const center = composer.rect.left + composer.rect.width / 2;
  const distance = ({ rect }: CelebrationSnapshotTarget) =>
    Math.hypot(
      rect.left + rect.width / 2 - center,
      rect.top - composer.rect.top,
    );
  buttons.sort((a, b) => distance(a) - distance(b));
  return {
    width,
    height,
    composer,
    buttons: buttons.slice(0, isMobile ? 1 : 2),
  };
};

import type { CelebrationAnchors } from '../models/celebration';
import type {
  CornerRect,
  CornerTarget,
  CornerTargets,
} from '../models/composer-corner';
import { findWelcomeRegion } from './host-anchors';
import type { SceneTargetBaseline } from './scene-targets';

export type { CornerRect } from '../models/composer-corner';

const MAX_CANDIDATES = 4;
const MAX_ANCESTORS = 24;
const SIDE_MARGIN = 12;
const VERTICAL_MARGIN = 20;
const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const CLIPPING = /^(auto|scroll|hidden|clip)$/;

const finite = (value: number) => Number.isFinite(value);

/** Returns the visible viewport, normally inset by the scene's safety margins. */
export const getVisibleViewport = (
  withSafetyMargins = true,
): CornerRect | null => {
  const { clientWidth: width, clientHeight: height } = document.documentElement;
  const viewport = window.visualViewport;
  let left = 0;
  let top = 0;
  let right = width;
  let bottom = height;
  if (viewport) {
    if (
      ![
        viewport.offsetLeft,
        viewport.offsetTop,
        viewport.width,
        viewport.height,
      ].every(finite)
    )
      return null;
    left = Math.max(left, viewport.offsetLeft);
    top = Math.max(top, viewport.offsetTop);
    right = Math.min(right, viewport.offsetLeft + viewport.width);
    bottom = Math.min(bottom, viewport.offsetTop + viewport.height);
  }
  if (withSafetyMargins) {
    left += SIDE_MARGIN;
    right -= SIDE_MARGIN;
    top += VERTICAL_MARGIN;
    bottom -= VERTICAL_MARGIN;
  }
  if (
    ![left, top, right, bottom].every(finite) ||
    right <= left ||
    bottom <= top
  )
    return null;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
};

/** Returns whether two rectangles share any positive area; touching edges are safe. */
export const cornerRectsIntersect = (
  a: CornerRect | DOMRectReadOnly,
  b: CornerRect | DOMRectReadOnly,
): boolean =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** Measures bounded visible semantic targets without animated-scene size or headroom limits. */
export const measureCornerTargets = (
  anchors: CelebrationAnchors,
  additionalProtectedClasses: readonly (string | undefined)[] = [],
): CornerTargets | null => {
  if (additionalProtectedClasses.length > MAX_CANDIDATES) return null;
  const rectangles = new Map<Element, DOMRect>();
  const styles = new Map<Element, CSSStyleDeclaration>();
  const targets = new Map<HTMLElement, CornerTarget | null>();
  const protectedTargets = new Map<Element, CornerTarget>();
  const watched = new Map<Element, SceneTargetBaseline>();
  const membershipChecks: (() => boolean)[] = [];
  const rectOf = (element: Element) => {
    let rect = rectangles.get(element);
    if (!rect) {
      rect = element.getBoundingClientRect();
      rectangles.set(element, rect);
    }
    return rect;
  };
  const styleOf = (element: Element) => {
    let style = styles.get(element);
    if (!style) {
      style = getComputedStyle(element);
      styles.set(element, style);
    }
    return style;
  };
  const read = (element: Element): CornerTarget | null => {
    if (!(element instanceof HTMLElement)) return null;
    if (targets.has(element)) return targets.get(element) ?? null;
    const rect = rectOf(element);
    if (
      ![
        rect.left,
        rect.top,
        rect.width,
        rect.height,
        rect.right,
        rect.bottom,
      ].every(finite)
    )
      throw new Error('Non-finite protected target');
    if (rect.width <= 0 || rect.height <= 0) {
      targets.set(element, null);
      return null;
    }
    let ancestor: HTMLElement | null = element;
    let isClipped = false;
    let visibleLeft = rect.left;
    let visibleRight = rect.right;
    let visibleTop = rect.top;
    let visibleBottom = rect.bottom;
    for (let depth = 0; ancestor && depth < MAX_ANCESTORS; depth++) {
      const style = styleOf(ancestor);
      if (
        ancestor.matches(EXCLUDED) ||
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse' ||
        style.opacity === '0' ||
        style.contentVisibility === 'hidden'
      ) {
        targets.set(element, null);
        return null;
      }
      if (ancestor !== element) {
        const clipX = CLIPPING.test(style.overflowX);
        const clipY = CLIPPING.test(style.overflowY);
        if (clipX || clipY) {
          const clip = rectOf(ancestor);
          if (clipX) {
            visibleLeft = Math.max(visibleLeft, clip.left);
            visibleRight = Math.min(visibleRight, clip.right);
          }
          if (clipY) {
            visibleTop = Math.max(visibleTop, clip.top);
            visibleBottom = Math.min(visibleBottom, clip.bottom);
          }
        }
      }
      ancestor = ancestor.parentElement;
    }
    if (ancestor)
      throw new Error('Protected target ancestry exceeds its budget');
    if (visibleLeft >= visibleRight || visibleTop >= visibleBottom) {
      targets.set(element, null);
      return null;
    }
    isClipped =
      visibleLeft > rect.left ||
      visibleRight < rect.right ||
      visibleTop > rect.top ||
      visibleBottom < rect.bottom;
    const target = { element, rect, isClipped };
    targets.set(element, target);
    return target;
  };
  const protect = (element: Element) => {
    const target = read(element);
    /* Hidden supplied controls may become visible without moving the composer. */
    if (element instanceof HTMLElement)
      watched.set(element, { element, rect: rectOf(element) });
    if (target) {
      protectedTargets.set(element, target);
    }
    return target;
  };
  const byClass = (
    name: string | undefined,
    root: Document | Element = document,
  ) => {
    if (!name) return [];
    const elements = root.getElementsByClassName(name);
    if (elements.length > MAX_CANDIDATES)
      throw new Error('Too many protected targets');
    const initial = Array.from(elements);
    /* HTMLCollections remain live; compare at most four identities, never layout. */
    membershipChecks.push(
      () =>
        elements.length !== initial.length ||
        initial.some((element, index) => elements[index] !== element),
    );
    return initial;
  };
  try {
    for (const name of additionalProtectedClasses)
      byClass(name).forEach(protect);
    const composers = byClass(anchors.composer)
      .map(protect)
      .filter((target): target is CornerTarget => target !== null);
    for (const name of [
      anchors.composerAddCluster,
      anchors.composerModelSelector,
    ])
      byClass(name).forEach(protect);
    const regions = new Set<Element>();
    for (const { element } of composers) {
      const region = findWelcomeRegion(element, anchors);
      if (region) regions.add(region);
    }
    if (!composers.length && anchors.welcomeRegion) {
      const matches = document.querySelectorAll(anchors.welcomeRegion);
      if (matches.length > MAX_CANDIDATES) return null;
      matches.forEach((region) => regions.add(region));
    }
    for (const region of regions) {
      watched.set(region, { element: region, rect: rectOf(region) });
      const headings = region.querySelectorAll('h1, h2, [role="heading"]');
      let hasHeading = false;
      for (let i = 0; i < Math.min(headings.length, MAX_CANDIDATES); i++) {
        if (protect(headings[i])) {
          hasHeading = true;
          break;
        }
      }
      if (!hasHeading && headings.length > MAX_CANDIDATES) return null;
      byClass(anchors.starterList, region).forEach(protect);
    }
    return {
      composers,
      protectedTargets: [...protectedTargets.values()],
      watched: [...watched.values()],
      hasTargetSetChanged: () => membershipChecks.some((check) => check()),
    };
  } catch {
    return null;
  }
};

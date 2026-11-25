import type { CelebrationAnchors } from '../../models/celebration';
import type { CelebrationSnapshotTarget } from '../../utils/celebration-snapshots';
import {
  type ComposerSource,
  measureComposer,
} from '../../utils/composer-target';
import { CatBaubleMode } from '../types/new-year';
import { CAT_FIR, CAT_RIG, TANGERINE_RADIUS } from './cat-bauble-art';

/** Measured stage of one bauble activation, in viewport pixels. */
export interface CatBaubleTargets {
  /** Viewport width. */
  width: number;
  /** Viewport height. */
  height: number;
  /** Whether the composer is right-to-left. */
  rtl: boolean;
  /** What the cat plays with. */
  mode: CatBaubleMode;
  /** CSS pixels per native unit. */
  scale: number;
  /** Viewport x direction from the composer's start edge to its end edge. */
  dir: 1 | -1;
  /** Along-rim direction from the toy toward the fir. */
  toward: 1 | -1;
  /** Viewport y of the composer rim the cat walks on. */
  floor: number;
  /** Viewport x of the composer's start edge. */
  startEdge: number;
  /** Composer width, the length of the rim. */
  span: number;
  /** Distance along the rim of the toy's centre. */
  toyA: number;
  /** Toy width in CSS pixels. */
  toyWidth: number;
  /** Toy height in CSS pixels. */
  toyHeight: number;
  /** Distance along the rim of the fir's trunk. */
  firA: number;
  /** The measured composer; `null` only in the static mode. */
  composer: ComposerSource | null;
  /** The borrowed model selector, or `null` for a drawn tangerine. */
  selector: CelebrationSnapshotTarget | null;
  /** Host elements whose mutation or movement cancels the scene. */
  watched: HTMLElement[];
}

/** Cat and fir size in CSS pixels per native unit. */
export const CAT_BAUBLE_SCALE = { desktop: 0.82, mobile: 0.66 } as const;
/** Viewport space the fir and a rearing cat need above the composer. */
export const CAT_BAUBLE_HEADROOM = { desktop: 180, mobile: 150 } as const;
/** Model selector size limits, in CSS pixels. */
export const CAT_SELECTOR_LIMITS = {
  minWidth: 36,
  maxWidth: 140,
  minHeight: 24,
  maxHeight: 44,
} as const;
/** Vertical squash of the cat lying on the rim. */
export const CAT_LYING_SQUASH = 70;

const MIN_COMPOSER_WIDTH = { desktop: 320, mobile: 260 } as const;
const SELECTOR_SCAN_LIMIT = 4;
const MAX_SELECTOR_NODES = 40;
const MAX_ANCESTORS = 24;
/* The fir stands this far in from its end of the rim, in native units. */
const FIR_INSET = 52;
/* Shortest slide from the toy to the trunk, in native units. */
const MIN_SLIDE = 120;
const EXCLUDED =
  '[hidden], [inert], [aria-hidden="true"], [data-celebration-snapshot]';
const CLIPPING = /^(auto|scroll|hidden|clip)$/;

/** Lowest point below the rim, in CSS pixels, that the lying cat's stretched paw reaches. */
export const catReach = (scale: number): number =>
  (CAT_RIG.leg * CAT_RIG.maxStretch +
    (CAT_RIG.shoulder[1] * CAT_LYING_SQUASH) / 100) *
  scale;

/** Tallest toy, in CSS pixels, that hangs from the hook without touching the rim. */
export const maxHangingHeight = (scale: number): number =>
  Math.min(
    CAT_SELECTOR_LIMITS.maxHeight,
    -CAT_FIR.hook[1] * CAT_FIR.scale * scale - 4,
  );

const matchesSafely = (element: Element, selector: string) => {
  try {
    return element.matches(selector);
  } catch {
    /* An engine without the pseudo-class cannot report the state. */
    return false;
  }
};

const isClipped = (element: HTMLElement, rect: DOMRect) => {
  let ancestor = element.parentElement;
  for (let depth = 0; ancestor && depth < MAX_ANCESTORS; depth++) {
    const style = getComputedStyle(ancestor);
    const clipX = CLIPPING.test(style.overflowX);
    const clipY = CLIPPING.test(style.overflowY);
    if (clipX || clipY) {
      const clip = ancestor.getBoundingClientRect();
      if (
        (clipX && (rect.left < clip.left || rect.right > clip.right)) ||
        (clipY && (rect.top < clip.top || rect.bottom > clip.bottom))
      )
        return true;
    }
    ancestor = ancestor.parentElement;
  }
  return false;
};

const isEligibleSelector = (
  element: HTMLElement,
  rect: DOMRect,
  composer: DOMRect,
  floor: number,
  scale: number,
): boolean => {
  if (!element.isConnected || !rect.width || !rect.height) return false;
  const style = getComputedStyle(element);
  return !(
    !element.matches('button, [role="button"]') ||
    element.matches(
      ':disabled, [aria-disabled="true"], [aria-expanded="true"]',
    ) ||
    element.isContentEditable ||
    style.display === 'none' ||
    style.visibility !== 'visible' ||
    style.opacity === '0' ||
    (style.transform !== 'none' && style.transform !== '') ||
    element.closest(EXCLUDED) ||
    element.contains(document.activeElement) ||
    matchesSafely(element, ':hover') ||
    matchesSafely(element, ':active') ||
    typeof element.animate !== 'function' ||
    rect.width < CAT_SELECTOR_LIMITS.minWidth ||
    rect.width > CAT_SELECTOR_LIMITS.maxWidth ||
    rect.height < CAT_SELECTOR_LIMITS.minHeight ||
    rect.height > maxHangingHeight(scale) ||
    rect.left < composer.left - 1 ||
    rect.right > composer.right + 1 ||
    rect.top < composer.top - 1 ||
    rect.bottom > composer.bottom + 1 ||
    rect.top - floor > catReach(scale) ||
    element.getElementsByTagName('*').length + 1 > MAX_SELECTOR_NODES ||
    isClipped(element, rect)
  );
};

/** Returns the first eligible model selector inside the composer, or `null`. */
const findSelector = (
  composer: ComposerSource,
  className: string | undefined,
  floor: number,
  scale: number,
): CelebrationSnapshotTarget | null => {
  if (!className) return null;
  const candidates = composer.element.getElementsByClassName(className);
  for (let i = 0; i < Math.min(candidates.length, SELECTOR_SCAN_LIMIT); i++) {
    const element = candidates[i];
    if (!(element instanceof HTMLElement)) continue;
    const rect = element.getBoundingClientRect();
    if (isEligibleSelector(element, rect, composer.rect, floor, scale))
      return { element, rect };
    /* The first rendered selector is the one the story borrows. */
    if (rect.width && rect.height) return null;
  }
  return null;
};

/** Places the fir at the rim end farther from the toy; `null` when the slide is too short. */
const stageFor = (span: number, toyA: number, toyWidth: number, s: number) => {
  const toward: 1 | -1 = toyA < span / 2 ? 1 : -1;
  const firA = toward > 0 ? span - FIR_INSET * s : FIR_INSET * s;
  const slide =
    Math.abs(firA - toyA) -
    toyWidth / 2 -
    CAT_FIR.trunkHalf * CAT_FIR.scale * s;
  return slide < MIN_SLIDE * s ? null : { toward, firA };
};

/** Measures the composer rim and its model selector once; falls back to a tangerine, or to the still without room. */
export const getCatBaubleTargets = (
  anchors: CelebrationAnchors,
  isMobile: boolean,
): CatBaubleTargets => {
  const layout = isMobile ? 'mobile' : 'desktop';
  const scale = CAT_BAUBLE_SCALE[layout];
  const { width, height, rtl, composer } = measureComposer(anchors.composer, {
    minWidth: MIN_COMPOSER_WIDTH[layout],
    headroom: CAT_BAUBLE_HEADROOM[layout],
  });
  const dir: 1 | -1 = rtl ? -1 : 1;
  const tangerine = TANGERINE_RADIUS * 2 * scale;
  const fallback: CatBaubleTargets = {
    width,
    height,
    rtl,
    mode: CatBaubleMode.Static,
    scale,
    dir,
    toward: 1,
    floor: height,
    startEdge: 0,
    span: 0,
    toyA: 0,
    toyWidth: tangerine,
    toyHeight: tangerine,
    firA: 0,
    composer: null,
    selector: null,
    watched: [],
  };
  if (!composer) return fallback;
  const { rect } = composer.source;
  const floor = rect.top - 3;
  const span = rect.width;
  const startEdge = dir > 0 ? rect.left : rect.right;
  const base = {
    ...fallback,
    floor,
    span,
    startEdge,
    composer: composer.source,
  };
  const selector = findSelector(
    composer.source,
    anchors.composerModelSelector,
    floor,
    scale,
  );
  if (selector) {
    const center = (selector.rect.left + selector.rect.right) / 2;
    const toyA = (center - startEdge) * dir;
    const stage = stageFor(span, toyA, selector.rect.width, scale);
    if (stage)
      return {
        ...base,
        ...stage,
        mode: CatBaubleMode.Selector,
        toyA,
        toyWidth: selector.rect.width,
        toyHeight: selector.rect.height,
        selector,
        watched: [composer.source.element, selector.element],
      };
  }
  const toyA = span * 0.28;
  const stage = stageFor(span, toyA, tangerine, scale);
  if (!stage) return fallback;
  return {
    ...base,
    ...stage,
    mode: CatBaubleMode.Tangerine,
    toyA,
    watched: [composer.source.element],
  };
};

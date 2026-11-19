/** A rectangle in viewport CSS pixels. */
export interface ComposerBox {
  /** Distance from the viewport's left edge. */
  left: number;
  /** Distance from the viewport's top edge. */
  top: number;
  /** Width. */
  width: number;
  /** Height. */
  height: number;
}

/** The measured composer element and its rectangle at measurement time. */
export interface ComposerSource {
  /** The composer element. */
  element: HTMLElement;
  /** Its rectangle when it was measured. */
  rect: DOMRect;
}

/** Viewport size, writing direction and the eligible composer, read once. */
export interface ComposerMeasurement {
  /** Viewport width in CSS pixels. */
  width: number;
  /** Viewport height in CSS pixels. */
  height: number;
  /** Whether the composer, or the document when none qualifies, is RTL. */
  rtl: boolean;
  /** The eligible composer's box and element; `null` when none qualifies. */
  composer: { box: ComposerBox; source: ComposerSource } | null;
}

/** Size and placement limits a composer must meet. */
export interface ComposerEligibility {
  /** Smallest accepted composer width, in CSS pixels. */
  minWidth: number;
  /** Viewport space required above the composer, in CSS pixels, or a function of its rectangle. */
  headroom: number | ((rect: DOMRect) => number);
}

/* Most composer candidates and ancestors inspected in one measurement. */
const MAX_COMPOSER_CANDIDATES = 4;
const MAX_COMPOSER_ANCESTORS = 24;

const MIN_HEIGHT = 36;
const MAX_HEIGHT = 260;
const SIDE_MARGIN = 12;
const BOTTOM_MARGIN = 20;
const EXCLUDED = '[hidden], [inert], [aria-hidden="true"]';
const CLIPPING = /^(auto|scroll|hidden|clip)$/;

const isVisibleAndUnclipped = (element: HTMLElement, rect: DOMRect) => {
  let parent: HTMLElement | null = element;
  for (let depth = 0; parent && depth < MAX_COMPOSER_ANCESTORS; depth++) {
    const style = getComputedStyle(parent);
    if (
      parent.matches(EXCLUDED) ||
      style.display === 'none' ||
      style.visibility !== 'visible' ||
      style.opacity === '0' ||
      style.contentVisibility === 'hidden'
    )
      return false;
    if (parent !== element) {
      const clipX = CLIPPING.test(style.overflowX);
      const clipY = CLIPPING.test(style.overflowY);
      if (clipX || clipY) {
        const clip = parent.getBoundingClientRect();
        if (
          (clipX && (rect.left < clip.left || rect.right > clip.right)) ||
          (clipY && (rect.top < clip.top || rect.bottom > clip.bottom))
        )
          return false;
      }
    }
    parent = parent.parentElement;
  }
  /* A chain deeper than the limit is not trusted. */
  return !parent;
};

/**
 * Measures the first eligible composer among at most four elements with
 * `composerClass`, once; it never writes to the DOM.
 */
export const measureComposer = (
  composerClass: string | undefined,
  { minWidth, headroom }: ComposerEligibility,
): ComposerMeasurement => {
  const { clientWidth, clientHeight } = document.documentElement;
  const width = Math.max(1, clientWidth);
  const height = Math.max(1, clientHeight);
  const candidates = composerClass
    ? document.getElementsByClassName(composerClass)
    : [];
  let rtl = getComputedStyle(document.documentElement).direction === 'rtl';
  for (
    let i = 0;
    i < Math.min(candidates.length, MAX_COMPOSER_CANDIDATES);
    i++
  ) {
    const element = candidates[i];
    if (!(element instanceof HTMLElement)) continue;
    const rect = element.getBoundingClientRect();
    rtl = getComputedStyle(element).direction === 'rtl';
    if (
      rect.width < minWidth ||
      rect.height < MIN_HEIGHT ||
      rect.height > MAX_HEIGHT ||
      rect.left < SIDE_MARGIN ||
      rect.right > width - SIDE_MARGIN ||
      rect.top < (typeof headroom === 'function' ? headroom(rect) : headroom) ||
      rect.bottom > height - BOTTOM_MARGIN
    )
      continue;
    if (!isVisibleAndUnclipped(element, rect)) continue;
    return {
      width,
      height,
      rtl,
      composer: {
        box: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        source: { element, rect },
      },
    };
  }
  return { width, height, rtl, composer: null };
};

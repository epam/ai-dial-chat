import type { RefObject } from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { RESIZABLE_FIELD_MAX_HEIGHT_CSS_VARIABLE } from '../constants/resizable-fields';

/** Space kept between the capped element and the bottom edge of its scroller. */
const DEFAULT_BOTTOM_GAP = 16;

/*
 * Lower bound for the cap. A field that starts below the fold — a long form on
 * a short viewport — would otherwise be capped to nothing, which is worse than
 * overflowing: the control becomes unusable rather than merely too tall.
 */
const DEFAULT_MIN_HEIGHT = 200;

const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'scroll', 'overlay']);

/** Options for `useAvailableHeightCap`. */
export interface UseAvailableHeightCapOptions {
  /** Pixels left between the element's bottom and the scroller's bottom edge. Defaults to `16`. */
  bottomGap?: number;
  /** Smallest cap to write, so a field below the fold stays usable. Defaults to `200`. */
  minHeight?: number;
  /** Custom property the cap is written to. Defaults to `RESIZABLE_FIELD_MAX_HEIGHT_CSS_VARIABLE`. */
  cssVariable?: string;
}

/**
 * Nearest ancestor that scrolls vertically, or the document scroller when the
 * element sits in an unconstrained page.
 */
const findScrollContainer = (element: HTMLElement): HTMLElement => {
  for (
    let ancestor = element.parentElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    const { overflowY } = getComputedStyle(ancestor);

    if (SCROLLABLE_OVERFLOW_VALUES.has(overflowY)) return ancestor;
  }

  return document.documentElement;
};

/**
 * Writes the height still available below an element into a CSS custom
 * property, so a user-resizable control inside it can be capped at the space
 * its form actually has rather than at a fixed fraction of the viewport.
 *
 * A `vh` ceiling only bounds a field against the height of the screen, not
 * against the room left underneath it: a field that starts 40% down a form can
 * be dragged to its full `70vh` and still run past the bottom of the page. The
 * cap here is measured instead — the scroller's visible height minus the space
 * the fields above occupy — and normalised by `scrollTop`, so it describes the
 * worst case (the form scrolled to its top) and does not shift while the user
 * scrolls or drags.
 *
 * Attach the returned ref to the element that wraps the resizable control and
 * give it a class that reads the property, e.g.
 * `MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME`; custom properties inherit, so the
 * class may target a descendant.
 */
export const useAvailableHeightCap = <TElement extends HTMLElement>({
  bottomGap = DEFAULT_BOTTOM_GAP,
  minHeight = DEFAULT_MIN_HEIGHT,
  cssVariable = RESIZABLE_FIELD_MAX_HEIGHT_CSS_VARIABLE,
}: UseAvailableHeightCapOptions = {}): RefObject<TElement | null> => {
  const elementRef = useRef<TElement>(null);

  const measureAvailableHeight = useCallback(() => {
    const element = elementRef.current;

    if (!element) return;

    const scrollContainer = findScrollContainer(element);
    const isDocumentScroller = scrollContainer === document.documentElement;
    const elementTop = element.getBoundingClientRect().top;
    /*
     * A scroll container keeps its own box in place while its content moves, so
     * the element's offset inside that content is its viewport offset relative
     * to the container plus how far the container is scrolled. The document
     * scroller is the exception: its box translates with the scroll, so its
     * rect is already accounted for by `scrollTop` alone.
     */
    const offsetWithinContent = isDocumentScroller
      ? elementTop + scrollContainer.scrollTop
      : elementTop -
        scrollContainer.getBoundingClientRect().top +
        scrollContainer.scrollTop;
    const availableHeight =
      scrollContainer.clientHeight - offsetWithinContent - bottomGap;
    const cap = `${Math.round(Math.max(availableHeight, minHeight))}px`;

    /* Writing the same value again would keep the ResizeObserver below busy. */
    if (element.style.getPropertyValue(cssVariable) === cap) return;

    element.style.setProperty(cssVariable, cap);
  }, [bottomGap, minHeight, cssVariable]);

  useLayoutEffect(() => {
    measureAvailableHeight();

    const element = elementRef.current;

    if (!element) return;

    /*
     * A resize of the scroller changes the cap directly. Content appearing
     * above the element moves it without resizing either one, and no observer
     * reports that, so re-measure when a drag is about to start as well — by
     * then the layout above has settled.
     */
    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(measureAvailableHeight);

    resizeObserver?.observe(findScrollContainer(element));
    element.addEventListener('pointerdown', measureAvailableHeight, true);
    window.addEventListener('resize', measureAvailableHeight);

    return () => {
      resizeObserver?.disconnect();
      element.removeEventListener('pointerdown', measureAvailableHeight, true);
      window.removeEventListener('resize', measureAvailableHeight);
    };
  }, [measureAvailableHeight]);

  return elementRef;
};

/** Returns the nearest scrollable ancestor, falling back to `<html>`. */
export const getScrollParent = (el: Element | null): Element => {
  if (!el || el === document.body) return document.documentElement;
  const { overflow, overflowY } = getComputedStyle(el);
  if (
    overflow === 'auto' ||
    overflow === 'scroll' ||
    overflowY === 'auto' ||
    overflowY === 'scroll'
  ) {
    return el;
  }
  return getScrollParent(el.parentElement);
};

/**
 * Scrolls `container` vertically just enough to bring `child` fully into
 * view. Unlike `scrollIntoView`, no other scrollable ancestor moves.
 */
export const scrollChildIntoContainerView = (
  container: HTMLElement,
  child: HTMLElement,
): void => {
  /* Rect deltas rather than `scrollIntoView({ block: 'nearest' })`, which also
     scrolls every scrollable ancestor — a bottom sheet's `overflow: auto`
     backdrop included, while the sheet is still sliding in from below. */
  const containerRect = container.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  if (childRect.top < containerRect.top) {
    container.scrollTop -= containerRect.top - childRect.top;
  } else if (childRect.bottom > containerRect.bottom) {
    container.scrollTop += childRect.bottom - containerRect.bottom;
  }
};

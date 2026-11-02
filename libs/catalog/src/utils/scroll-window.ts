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

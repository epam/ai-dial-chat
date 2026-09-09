/*
 * Anything the browser will land on with Tab. `[tabindex]` is included so
 * custom widgets participate; the negative-tabindex filter below then drops
 * the panel's own programmatic focus target.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]',
].join(',');

/*
 * Deliberately layout-free: the panel hides content by not rendering it, so
 * there is nothing here that a geometry check would catch and these checks
 * would not — and geometry is unavailable under jsdom, which would leave the
 * trap untestable.
 */
const isReachable = (element: HTMLElement): boolean => {
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;
  if (element.tabIndex < 0) return false;
  return element.closest('[inert],[hidden],[aria-hidden="true"]') == null;
};

/** Elements inside `container` that Tab can reach, in document order. */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isReachable);

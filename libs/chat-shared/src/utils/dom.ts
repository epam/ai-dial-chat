/**
 * Makes every child of `document.body` inert except the one holding
 * `element`, for an overlay that dims the page without trapping focus.
 * Returns the function that restores them; a child already inert is left as
 * it was.
 */
export const makeOutsideInert = (element: HTMLElement): (() => void) => {
  const outside = [...document.body.children].filter(
    (child) => !child.contains(element) && !child.hasAttribute('inert'),
  );
  for (const child of outside) child.setAttribute('inert', '');
  return () => {
    for (const child of outside) child.removeAttribute('inert');
  };
};

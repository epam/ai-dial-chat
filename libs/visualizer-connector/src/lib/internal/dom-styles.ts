/** Applies each non-falsy entry of `styles` as an inline style property on `element`. */
export const setStyles = (
  element: HTMLElement,
  styles: Record<string, string>,
): void => {
  for (const key in styles) {
    const value = styles[key];
    if (!value) continue;
    (element.style as unknown as Record<string, string>)[key] = value;
  }
};

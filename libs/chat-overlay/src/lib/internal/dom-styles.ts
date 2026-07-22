/** Applies each entry of `styles` as an inline style property on `element`. */
export const setStyles = (
  element: HTMLElement,
  styles: Record<string, string>,
): void => {
  Object.assign(element.style, styles);
};

const CORNERS = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
] as const;

/* A length radius grows by the padding so the outline stays concentric with
 * the element; a percentage already scales with the outline's own box. */
const outsetRadius = (radius: string, padding: number): string => {
  if (radius.endsWith('%')) {
    return radius;
  }
  const value = parseFloat(radius);
  return Number.isFinite(value) && value > 0 ? `${value + padding}px` : '0px';
};

/** Returns a `border-radius` value for an outline drawn `padding` px outside `element` that follows the element's own corners. */
export const spotlightRadius = (
  element: HTMLElement,
  padding: number,
): string => {
  const style = getComputedStyle(element);
  return CORNERS.map((corner) => outsetRadius(style[corner], padding)).join(
    ' ',
  );
};

import { SPOTLIGHT_MIN_RADIUS } from '../constants/layout';

const CORNERS = [
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
] as const;

/* A length radius grows by the padding so the outline stays concentric with
 * the element; a percentage already scales with the outline's own box. A
 * square or barely rounded element, such as a bare textarea, still gets a
 * softly rounded outline. */
const outsetRadius = (radius: string, padding: number): string => {
  if (radius.endsWith('%')) {
    return radius;
  }
  const value = parseFloat(radius);
  const outset = Number.isFinite(value) && value > 0 ? value + padding : 0;
  return `${Math.max(outset, SPOTLIGHT_MIN_RADIUS)}px`;
};

/** Returns a `border-radius` value for an outline drawn `padding` px outside `element` that follows the element's own corners, never below `SPOTLIGHT_MIN_RADIUS`. */
export const spotlightRadius = (
  element: HTMLElement,
  padding: number,
): string => {
  const style = getComputedStyle(element);
  return CORNERS.map((corner) => outsetRadius(style[corner], padding)).join(
    ' ',
  );
};

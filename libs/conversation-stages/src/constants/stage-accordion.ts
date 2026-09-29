/*
 * Geometry shared by every stage disclosure. The kit `Accordion` is sized for
 * a settings panel (`py-3`, a 16px inline gutter, a caret pushed to the far
 * edge); a stage row is a compact list item, so these classes replace that
 * geometry while the kit keeps the button, the region and the animation.
 */

/** Classes merged onto each stage `Accordion` root: no block padding, and no clipping of the header's focus ring. */
export const STAGE_ACCORDION_CLASS_NAME = 'overflow-visible py-0';

/** Classes merged onto each stage `Accordion` header: the compact row, with the caret right after the text. */
export const STAGE_ACCORDION_HEADER_CLASS_NAME =
  'justify-start gap-2 rounded-lg px-2 py-1.5 text-start';

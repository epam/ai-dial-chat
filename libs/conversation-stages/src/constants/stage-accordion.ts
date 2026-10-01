/*
 * Geometry shared by every stage disclosure. The kit `Accordion` is sized for
 * a settings panel (`py-3`, a 16px inline gutter, a caret pushed to the far
 * edge); a stage row is a compact list item, so these classes replace that
 * geometry while the kit keeps the button, the region and the animation.
 */

/** Classes merged onto each stage `Accordion` root: no block padding, and no clipping of the header's focus ring. */
export const STAGE_ACCORDION_CLASS_NAME = 'min-w-0 overflow-visible py-0';

/** Classes merged onto each stage `Accordion` header: the compact row, with the caret right after the text and a 44px touch target on mobile. */
export const STAGE_ACCORDION_HEADER_CLASS_NAME =
  'min-w-0 justify-start gap-2 rounded-lg px-2 py-1.5 text-start mobile:min-h-11';

/**
 * Nesting levels (child lists and retry-attempt lists) that still add inline
 * indentation. Deeper levels align with the last indented one, so a deep
 * hierarchy never runs out of width; semantic nesting is not capped.
 */
export const MAX_INDENTED_STAGE_DEPTH = 3;

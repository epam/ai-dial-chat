/** Fixed pixel height of a single card (description clamped to 3 lines). */
export const CARD_HEIGHT = 300;

/** Vertical gap between card rows, matching the `gap-5` grid spacing (20 px). */
export const CARD_ROW_GAP = 20;

/** Total height allocated per virtual row: card height + row gap. */
export const CARD_ROW_HEIGHT = CARD_HEIGHT + CARD_ROW_GAP;

/** Number of skeleton card rows rendered while data is loading. */
export const SKELETON_ROW_COUNT = 3;

/** Minimum container width (px) at which the grid switches to three columns. */
export const DESKTOP_BREAKPOINT = 769;

/** Column count on desktop viewports (≥ DESKTOP_BREAKPOINT). */
export const DESKTOP_COLUMNS = 3;

/** Column count on mobile viewports (< DESKTOP_BREAKPOINT). */
export const MOBILE_COLUMNS = 1;

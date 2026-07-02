/**
 * Card height: 44padding + 44identity(sm) + 14gap + 44desc(2ln@22px,min44) + 14gap + 28tags(min28) + auto-space + 29strip(1border+12pt+16content) = ~217 + auto.
 * Strip is pinned to card bottom via mt-auto; auto-space absorbs remaining flex free space.
 */
export const CARD_HEIGHT = 248;

/** Vertical gap between card rows, matching the `gap-5` grid spacing (20 px). */
export const CARD_ROW_GAP = 20;

/** Total height allocated per virtual row. */
export const CARD_ROW_HEIGHT = CARD_HEIGHT + CARD_ROW_GAP;

/** Number of skeleton card rows rendered while data is loading. */
export const SKELETON_ROW_COUNT = 3;

/**
 * Minimum container width (px) at which the grid switches from 1 to 2 columns.
 * With 4 % side padding the container is ≈ 92 % of the available area:
 *   desktop (60 px sidebar): viewport ≥ 60 + 620 / 0.92 ≈ 734 px
 */
export const DESKTOP_BREAKPOINT = 620;

/**
 * Minimum container width (px) at which the grid switches from 2 to 3 columns.
 * Desktop viewport ≈ 60 + 966 / 0.92 ≈ 1110 px.
 */
export const TABLET_BREAKPOINT = 966;

/**
 * Minimum container width (px) at which the grid switches from 3 to 4 columns.
 * Desktop viewport ≈ 60 + 1280 / 0.92 ≈ 1451 px.
 */
export const XLARGE_BREAKPOINT = 1280;

/** Column count on very wide desktop viewports (≥ XLARGE_BREAKPOINT). */
export const XLARGE_COLUMNS = 4;

/** Column count on large desktop viewports (TABLET_BREAKPOINT ≤ w < XLARGE_BREAKPOINT). */
export const DESKTOP_COLUMNS = 3;

/** Column count on tablet/small-desktop viewports (DESKTOP_BREAKPOINT ≤ w < TABLET_BREAKPOINT). */
export const TABLET_COLUMNS = 2;

/** Column count on mobile viewports (< DESKTOP_BREAKPOINT). */
export const MOBILE_COLUMNS = 1;

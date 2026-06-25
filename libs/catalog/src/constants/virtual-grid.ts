/**
 * Card height: 2border + 32padding(p-4) + 48header + 8gap + 40desc(2ln) + 8gap + 24tags(1row) + 16inner-gap + 35footer + 1buffer = 214.
 * Footer: 1border-t + 8pt-2 + 26star-btn(py-1 !h-auto).
 */
export const CARD_HEIGHT = 214;

/** Vertical gap between card rows, matching the `gap-5` grid spacing (20 px). */
export const CARD_ROW_GAP = 20;

/** Total height allocated per virtual row. */
export const CARD_ROW_HEIGHT = CARD_HEIGHT + CARD_ROW_GAP;

/** Number of skeleton card rows rendered while data is loading. */
export const SKELETON_ROW_COUNT = 3;

/**
 * Minimum container width (px) at which the grid switches from 1 to 2 columns.
 * With 15 % side padding the container is 70 % of the grid area:
 *   mobile (no sidebar): viewport ≥ 886 px  (620 / 0.7)
 *   desktop (60 px sidebar): viewport ≥ 946 px  (620 / 0.7 + 60)
 * This keeps all mobile viewports (≤ 768 px) at a single column.
 */
export const DESKTOP_BREAKPOINT = 620;

/**
 * Minimum container width (px) at which the grid switches from 2 to 3 columns.
 * Desktop viewport ≈ 1440 px  (966 / 0.7 + 60).
 */
export const TABLET_BREAKPOINT = 966;

/** Column count on large desktop viewports (≥ TABLET_BREAKPOINT). */
export const DESKTOP_COLUMNS = 3;

/** Column count on tablet/small-desktop viewports (DESKTOP_BREAKPOINT ≤ w < TABLET_BREAKPOINT). */
export const TABLET_COLUMNS = 2;

/** Column count on mobile viewports (< DESKTOP_BREAKPOINT). */
export const MOBILE_COLUMNS = 1;

/** Total attachment count at/above which the tile list switches from a wrapping flex row to a fixed 5-column grid. */
export const ATTACHMENT_COLLAPSE_THRESHOLD = 5;
/** Base Tailwind classes shared by every square attachment tile (100 × 100 px). */
export const ATTACHMENT_TILE_BASE_CLASS =
  'flex size-[100px] items-center justify-center rounded-xl border';
/** Tailwind classes drawing the 1px tile focus ring, 1px clear of the border, on keyboard focus of the tile itself. */
export const ATTACHMENT_TILE_FOCUS_RING_CLASS =
  'outline-1 outline-offset-1 focus-visible:outline';

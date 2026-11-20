/** Minimum distance, in px, between a hint card and the viewport edge. */
export const VIEWPORT_MARGIN = 16;
/** Distance, in px, between a hint card and its target. */
export const TARGET_GAP = 12;
/** Padding, in px, between the element and the edge of the cut-out around it. */
export const SPOTLIGHT_PADDING = 6;
/** Width, in px, of the arrow that points from a hint card at its target. */
export const ARROW_WIDTH = 16;
/** Height, in px, of that arrow. */
export const ARROW_HEIGHT = 8;
/** Smallest corner radius, in px, of an outline drawn around an element. */
export const SPOTLIGHT_MIN_RADIUS = 8;
/** Minimum interval, in ms, between two lookups of a hint's target while the page changes. */
export const TARGET_RESOLVE_THROTTLE_MS = 250;
/** Selector of the lib's own overlays, whose mutations never move a target. */
export const OWN_OVERLAY_SELECTOR =
  '.dial-onboarding-tour-root, .dial-onboarding-anchor-map-root';

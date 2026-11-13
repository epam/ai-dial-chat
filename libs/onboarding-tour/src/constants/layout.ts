/** Minimum distance, in px, between a hint card and the viewport edge. */
export const VIEWPORT_MARGIN = 16;
/** Distance, in px, between a hint card and its target. */
export const TARGET_GAP = 12;
/** Padding, in px, between the spotlighted element and the spotlight outline. */
export const SPOTLIGHT_PADDING = 6;
/** Smallest corner radius, in px, of an outline drawn around an element. */
export const SPOTLIGHT_MIN_RADIUS = 8;
/** Size, in px, of a beacon's hit area. */
export const BEACON_SIZE = 24;
/** Minimum interval, in ms, between two lookups of a hint's target while the page changes. */
export const TARGET_RESOLVE_THROTTLE_MS = 250;
/** Selector of the lib's own overlays, whose mutations never move a target. */
export const OWN_OVERLAY_SELECTOR =
  '.dial-onboarding-tour-root, .dial-onboarding-beacons-root, .dial-onboarding-anchor-map-root';

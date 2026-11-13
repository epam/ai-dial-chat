/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the tour and the beacons through these instead of hashed
 * CSS-module locals or DOM order. These classes carry no declarations of their
 * own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const ONBOARDING_TOUR_CLASS = {
  /** The fixed overlay that covers the page while the tour runs. */
  root: 'dial-onboarding-tour-root',
  /** The outline drawn around the spotlighted element. */
  spotlight: 'dial-onboarding-tour-spotlight',
  /** The `role="dialog"` hint card, in the tour and when a beacon is open. */
  card: 'dial-onboarding-tour-card',
} as const;

/** Public, host-addressable class names of `OnboardingBeacons`. */
export const ONBOARDING_BEACONS_CLASS = {
  /** The element holding every beacon and the open card. */
  root: 'dial-onboarding-beacons-root',
  /** Each beacon button. */
  beacon: 'dial-onboarding-beacons-beacon',
} as const;

/** Public, host-addressable class names of `OnboardingAnchorMap`. */
export const ONBOARDING_ANCHOR_MAP_CLASS = {
  /** The fixed layer holding every outline, tag and the panel. */
  root: 'dial-onboarding-anchor-map-root',
  /** The dashed outline around each anchor on screen. */
  outline: 'dial-onboarding-anchor-map-outline',
  /** The name tag above each outline. */
  tag: 'dial-onboarding-anchor-map-tag',
  /** The panel listing the anchors that are not on screen. */
  panel: 'dial-onboarding-anchor-map-panel',
} as const;

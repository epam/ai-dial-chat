/** How the client presents the operator-configured onboarding hints. */
export enum OnboardingHintsMode {
  /** A one-time, step-by-step tour that dims the page and spotlights each hint's element. */
  Tour = 'tour',
  /** A beacon on each hint's element that opens the hint on demand. */
  Beacons = 'beacons',
}

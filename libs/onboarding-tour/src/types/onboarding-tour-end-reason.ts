/** Why a tour ended, as reported to `OnboardingTourProps.onFinish`. */
export enum OnboardingTourEndReason {
  /** The user pressed Done on the last step, or no remaining step had a target. */
  Done = 'done',
  /** The user pressed the close button or Escape: the tour ends for now. */
  Closed = 'closed',
  /** The user pressed Skip tour: they opt out of the onboarding. */
  Skipped = 'skipped',
}

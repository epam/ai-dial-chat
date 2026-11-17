/** Why a tour ended, as reported to `OnboardingTourProps.onFinish`. */
export enum OnboardingTourEndReason {
  /** The user pressed Done on the last step, or no remaining step had a target. */
  Done = 'done',
  /** The user pressed Skip tour or the close button, or pressed Escape. */
  Dismissed = 'dismissed',
}

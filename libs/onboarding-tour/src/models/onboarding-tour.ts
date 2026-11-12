/** One hint: the copy shown in its card and the element it points at. */
export interface OnboardingTourStep {
  /** Stable id of the hint, reported back through `onFinish` / `onDismiss`. */
  id: string;
  /** Card heading; also the card's accessible name. */
  title: string;
  /** Optional body text below the heading; also the card's accessible description. */
  description?: string;
  /** Returns the element the hint points at, or `null` when it is not on screen; called again whenever the page changes. */
  getTarget: () => HTMLElement | null;
}

/** Colors shared by the hint card of `OnboardingTour` and `OnboardingBeacons`. */
export interface OnboardingCardColors {
  /** Hint card background. Defaults to `--bg-layer-raised`. */
  cardBackground?: string;
  /** Hint card border. Defaults to `--stroke-tertiary`. */
  cardBorder?: string;
  /** Hint card drop shadow color. Defaults to `--shadow-lg`. */
  cardShadow?: string;
  /** Card title text. Defaults to `--text-primary`. */
  titleText?: string;
  /** Card description text. Defaults to `--text-secondary`. */
  descriptionText?: string;
}

/** User-visible strings of the `OnboardingTour` component. */
export interface OnboardingTourLabels {
  /** Step counter above the title. Defaults to `` (current, total) => `Step ${current} of ${total}` ``. */
  stepCounter?: (current: number, total: number) => string;
  /** Label of the button that opens the next hint. Defaults to `'Next'`. */
  next?: string;
  /** Label of the button that returns to the previous hint. Defaults to `'Back'`. */
  back?: string;
  /** Label of the button on the last hint that ends the tour. Defaults to `'Done'`. */
  done?: string;
  /** Label of the button that ends the tour early. Defaults to `'Skip tour'`. */
  skip?: string;
  /** Accessible label of the card's close button. Defaults to `'Close tour'`. */
  close?: string;
}

/** Color overrides of the `OnboardingTour` component. */
export interface OnboardingTourColors extends OnboardingCardColors {
  /** Dimming layer over the page outside the spotlight. Defaults to `--bg-backdrop`. */
  backdrop?: string;
  /** Border around the spotlighted element. Defaults to `--stroke-accent`. */
  spotlightBorder?: string;
  /** Step counter text. Defaults to `--text-tertiary`. */
  counterText?: string;
}

/** Props for the `OnboardingTour` component. */
export interface OnboardingTourProps {
  /** Hints to walk through, in order; the tour renders nothing while the list is empty and restarts from the first hint when the list changes. */
  steps: OnboardingTourStep[];
  /** Called with every step id when the user finishes, skips, closes or presses Escape, or when no remaining step has a target; the host clears `steps` in response. */
  onFinish: (shownStepIds: string[]) => void;
  /** When `true`, the card is a bottom sheet instead of a popover next to the target. Defaults to `false`. */
  isMobile?: boolean;
  /** Text direction of the overlay, used to align the card with its target. Defaults to the direction inherited from the document. */
  dir?: 'ltr' | 'rtl';
  /** User-visible strings; each missing field falls back to its English default. */
  labels?: OnboardingTourLabels;
  /** Color overrides, applied as CSS custom properties on the overlay. */
  colors?: OnboardingTourColors;
  /** Typography class of the step counter. Defaults to `'dial-tiny-text'`. */
  counterClassName?: string;
  /** Typography class of the card title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Typography class of the card description. Defaults to `'dial-small-paragraph-text'`. */
  descriptionClassName?: string;
  /** Extra class name(s) merged onto the overlay root. */
  className?: string;
}

/** User-visible strings of the `OnboardingBeacons` component. */
export interface OnboardingBeaconsLabels {
  /** Accessible label of a beacon, given the hint title. Defaults to `` (title) => `Show hint: ${title}` ``. */
  beacon?: (title: string) => string;
  /** Label of the card button that dismisses the hint for good. Defaults to `'Got it'`. */
  gotIt?: string;
}

/** Color overrides of the `OnboardingBeacons` component. */
export interface OnboardingBeaconsColors extends OnboardingCardColors {
  /** Fill of the beacon dot and its pulse. Defaults to `--bg-accent-primary`. */
  beacon?: string;
  /** Ring around the beacon dot that separates it from the page. Defaults to `--bg-layer-0`. */
  beaconRing?: string;
  /** Focus outline of a keyboard-focused beacon. Defaults to `--stroke-focus`. */
  beaconFocusOutline?: string;
}

/** Props for the `OnboardingBeacons` component. */
export interface OnboardingBeaconsProps {
  /** Hints to mark with a beacon; a hint whose target is not on screen shows no beacon until its target appears. */
  hints: OnboardingTourStep[];
  /** Called with a hint's id when the user dismisses it with the card's Got it button; the host removes it from `hints`. */
  onDismiss: (id: string) => void;
  /** Text direction of the beacons and cards. Defaults to the direction inherited from the document. */
  dir?: 'ltr' | 'rtl';
  /** User-visible strings; each missing field falls back to its English default. */
  labels?: OnboardingBeaconsLabels;
  /** Color overrides, applied as CSS custom properties on every beacon and card. */
  colors?: OnboardingBeaconsColors;
  /** Typography class of the card title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** Typography class of the card description. Defaults to `'dial-small-paragraph-text'`. */
  descriptionClassName?: string;
  /** Extra class name(s) merged onto the beacons root. */
  className?: string;
}

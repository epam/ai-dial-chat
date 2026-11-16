import type { OnboardingTourEndReason } from '../types/onboarding-tour-end-reason';

/** One hint: the copy shown in its card and the element it points at. */
export interface OnboardingTourStep {
  /** Stable id of the hint, reported back through `onFinish`. */
  id: string;
  /** Card heading; also the card's accessible name. */
  title: string;
  /** Optional body text below the heading; also the card's accessible description. */
  description?: string;
  /** Returns the element the hint points at, or `null` when it is not on screen; called again whenever the page changes. */
  getTarget: () => HTMLElement | null;
}

/** Colors of the hint card of `OnboardingTour`. */
export interface OnboardingCardColors {
  /** Hint card background. Defaults to `--bg-layer-raised`. */
  cardBackground?: string;
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
  /** Dimming layer over the page behind the card. Defaults to `--bg-backdrop`. */
  backdrop?: string;
  /** Step counter text. Defaults to `--text-tertiary`. */
  counterText?: string;
}

/** Props for the `OnboardingTour` component. */
export interface OnboardingTourProps {
  /** Hints to walk through, in order; the tour renders nothing while the list is empty and restarts from the first hint when the list changes. */
  steps: OnboardingTourStep[];
  /** Called with the ids of the steps that were on screen when the tour ends, and why it ended; the host clears `steps` in response. */
  onFinish: (shownStepIds: string[], reason: OnboardingTourEndReason) => void;
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

/** One anchor shown by `OnboardingAnchorMap`. */
export interface OnboardingAnchor {
  /** Name of the anchor, shown in its tag and in the list of anchors not on the page. */
  id: string;
  /** Returns the anchor's element, or `null` when it is not on screen; called again whenever the page changes. */
  getTarget: () => HTMLElement | null;
}

/** User-visible strings of the `OnboardingAnchorMap` component. */
export interface OnboardingAnchorMapLabels {
  /** Panel heading, given how many anchors are on screen out of all of them. Defaults to `` (found, total) => `${found} of ${total} anchors on this page` ``. */
  summary?: (found: number, total: number) => string;
  /** Heading above the anchors that are not on screen. Defaults to `'Not on this page'`. */
  missingHeading?: string;
  /** Text shown when every anchor is on screen. Defaults to `'Every anchor is on this page'`. */
  noneMissing?: string;
  /** Accessible label of the panel's close button. Defaults to `'Close anchor view'`. */
  close?: string;
}

/** Color overrides of the `OnboardingAnchorMap` component. */
export interface OnboardingAnchorMapColors {
  /** Dashed outline around each anchor. Defaults to `--stroke-accent`. */
  outline?: string;
  /** Background of each anchor's name tag. Defaults to `--bg-layer-raised`. */
  tagBackground?: string;
  /** Text of each anchor's name tag. Defaults to `--text-accent`. */
  tagText?: string;
  /** Panel background. Defaults to `--bg-layer-raised`. */
  panelBackground?: string;
  /** Panel border. Defaults to `--stroke-tertiary`. */
  panelBorder?: string;
  /** Panel drop shadow color. Defaults to `--shadow-lg`. */
  panelShadow?: string;
  /** Panel heading text. Defaults to `--text-primary`. */
  panelText?: string;
  /** Panel list text. Defaults to `--text-secondary`. */
  panelMutedText?: string;
}

/** Props for the `OnboardingAnchorMap` component. */
export interface OnboardingAnchorMapProps {
  /** Anchors to outline; one that is not on screen is listed in the panel instead. */
  anchors: OnboardingAnchor[];
  /** Called when the panel's close button is pressed. */
  onClose: () => void;
  /** Text direction of the tags and the panel. Defaults to the direction inherited from the document. */
  dir?: 'ltr' | 'rtl';
  /** User-visible strings; each missing field falls back to its English default. */
  labels?: OnboardingAnchorMapLabels;
  /** Color overrides, applied as CSS custom properties on the map root. */
  colors?: OnboardingAnchorMapColors;
  /** Typography class of each anchor's name tag. Defaults to `'dial-tiny-semi-text'`. */
  tagClassName?: string;
  /** Typography class of the panel heading. Defaults to `'dial-small-semi-text'`. */
  summaryClassName?: string;
  /** Typography class of the panel's list and its heading. Defaults to `'dial-tiny-text'`. */
  itemClassName?: string;
  /** Extra class name(s) merged onto the map root. */
  className?: string;
}

/** One operator-configured hint: its copy and the target name the host resolves. */
export interface OnboardingHint {
  /** Stable id of the hint; seen ids are tracked by it. */
  id: string;
  /** Name of the element the hint points at, resolved by the host's `resolveTarget`. */
  target: string;
  /** Card heading. */
  title: string;
  /** Optional body text; `null` and `undefined` both mean none. */
  description?: string | null;
}

/** Options of `useOnboardingHints`. */
export interface UseOnboardingHintsOptions {
  /** Hints to show, in order. */
  hints: OnboardingHint[];
  /** Ids of the hints this user has already seen. */
  seenIds: string[];
  /** Called with the new list of seen ids once a tour ends; the host persists it. */
  onSeenIdsChange: (seenIds: string[]) => void;
  /** Returns the on-screen element of a target, or `null` when the page does not render it. */
  resolveTarget: (target: string) => HTMLElement | null;
  /** `false` while the hints are loading or the host shows something else instead. */
  isEnabled: boolean;
  /** A value that changes on navigation, such as the pathname; each change looks for hints again. */
  pageKey?: unknown;
}

/** Return value of `useOnboardingHints`. */
export interface UseOnboardingHintsResult {
  /** Steps to pass to `OnboardingTour`; empty while no tour runs. */
  steps: OnboardingTourStep[];
  /** Pass to `OnboardingTour` as `onFinish`: marks the shown ids seen (every hint's id when dismissed) and ends the tour. */
  onFinish: (shownIds: string[], reason: OnboardingTourEndReason) => void;
}

/** User-visible strings of the `OnboardingHints` component. */
export interface OnboardingHintsLabels {
  /** Strings of the tour; each missing field falls back to its English default. */
  tour?: OnboardingTourLabels;
  /** Strings of the anchor map; each missing field falls back to its English default. */
  anchorMap?: OnboardingAnchorMapLabels;
}

/** Props for the `OnboardingHints` component. */
export interface OnboardingHintsProps extends UseOnboardingHintsOptions {
  /** Every target name the host can resolve, outlined while `isAnchorView` is set. */
  anchorTargets: string[];
  /** When `true`, outlines every anchor on the page instead of showing hints. Defaults to `false`. */
  isAnchorView?: boolean;
  /** Called when the anchor map's close button is pressed; without it the button does nothing. */
  onCloseAnchorView?: () => void;
  /** When `true`, the hint card is a bottom sheet. Defaults to `false`. */
  isMobile?: boolean;
  /** Text direction of the tour and the anchor map. Defaults to the direction inherited from the document. */
  dir?: 'ltr' | 'rtl';
  /** User-visible strings of the tour and the anchor map. */
  labels?: OnboardingHintsLabels;
}

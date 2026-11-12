import type { OnboardingCardColors } from '../models/onboarding-tour';

/** Returns the CSS custom properties `HintCard` reads, keyed by name, for `buildCssVars`. */
export const cardColorVars = (
  colors: OnboardingCardColors | undefined,
): Record<string, string | undefined> => ({
  '--ot-card-bg': colors?.cardBackground,
  '--ot-card-border': colors?.cardBorder,
  '--ot-card-shadow': colors?.cardShadow,
  '--ot-title-text': colors?.titleText,
  '--ot-description-text': colors?.descriptionText,
});

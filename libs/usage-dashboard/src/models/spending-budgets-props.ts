import type {
  UsageLimitCardData,
  UsageLimitCardGroupLabels,
  UsageLimitCardGroupStyles,
} from './usage-limit-card-props';

/** One spending budget, already normalized and formatted by the host. */
export interface SpendingBudgetData {
  /** Stable key of the budget, unique within the list. */
  id: string;
  /** Visible budget name, also the accessible name of its group. */
  title: string;
  /** Preformatted line naming the models the budget covers; omitted when the host has none. */
  coverageLabel?: string;
  /** The budget's period cards, in display order. */
  cards: UsageLimitCardData[];
}

/** Localized strings for `SpendingBudgetsSection`. */
export interface SpendingBudgetsSectionLabels {
  /** Section heading, also the section's accessible name. */
  headingLabel: string;
  /** Text below the heading; omitted when not set. */
  descriptionLabel?: string;
  /** Informational notice above the budgets; omitted when not set. */
  noticeLabel?: string;
  /** Text shown in place of the budgets when the list is empty; the section renders nothing when the list is empty and this is not set. */
  emptyStateLabel?: string;
}

/** Color overrides for `SpendingBudgetsSection`, applied as CSS custom properties. */
export interface SpendingBudgetsSectionColors {
  /** Section heading color. Fallback: `--text-primary`. */
  headingColor?: string;
  /** Description and empty-state text color. Fallback: `--text-secondary`. */
  descriptionColor?: string;
  /** Budget title color. Fallback: `--text-primary`. */
  titleColor?: string;
  /** Coverage line color. Fallback: `--text-secondary`. */
  coverageColor?: string;
}

/** Typography class overrides for `SpendingBudgetsSection`. */
export interface SpendingBudgetsSectionTypography {
  /** CSS class for the section heading. Defaults to `'dial-h3-text'`. */
  headingClassName?: string;
  /** CSS class for the description and empty-state text. Defaults to `'dial-small-text'`. */
  descriptionClassName?: string;
  /** CSS class for each budget title. Defaults to `'dial-body-semi-text'`. */
  titleClassName?: string;
  /** CSS class for each coverage line. Defaults to `'dial-small-text'`. */
  coverageClassName?: string;
}

/** Style overrides accepted by `SpendingBudgetsSection`. */
export interface SpendingBudgetsSectionStyles {
  /** The section's own color overrides. */
  colors?: SpendingBudgetsSectionColors;
  /** The section's own typography overrides. */
  typography?: SpendingBudgetsSectionTypography;
  /** Styles forwarded to every `UsageLimitCard` in the section. */
  cards?: UsageLimitCardGroupStyles;
}

/** Props for `SpendingBudgetsSection`. */
export interface SpendingBudgetsSectionProps {
  /** Budgets to render, in display order. */
  budgets: SpendingBudgetData[];
  /** Localized section strings. */
  labels: SpendingBudgetsSectionLabels;
  /** Localized strings shared by every card. */
  cardLabels: UsageLimitCardGroupLabels;
  /** Style overrides. */
  styles?: SpendingBudgetsSectionStyles;
}

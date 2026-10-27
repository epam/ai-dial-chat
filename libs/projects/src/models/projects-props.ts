import type { SelectOption } from '@epam/ai-dial-ui-kit';
import type { ProjectSource } from '../types/project-source';
import type { ProjectsSortKey } from '../types/projects-sort-key';
import type { ProjectItem } from './project-item';

/** Localized labels used by the {@link Projects} component. */
export interface ProjectsLabels {
  /** Page title, e.g. "Projects". */
  title: string;
  /** One-line description shown beneath the title. */
  subtitle: string;
  /** Placeholder text for the toolbar search input. */
  searchPlaceholder: string;
  /** Accessible label for the toolbar search input. */
  searchAriaLabel: string;
  /** Accessible label for the search input's clear action. */
  clearSearchLabel: string;
  /** Accessible name of the group wrapping the sort control, e.g. "Sort". */
  sortLabel: string;
  /** Options the sort menu lists; each `value` is a `ProjectsSortKey`. */
  sortOptions: SelectOption[];
  /** Message shown when there are no projects at all. */
  emptyStateLabel: string;
  /** Secondary line under `emptyStateLabel`. Omitted when not set. */
  emptyStateDescription?: string;
  /** Message shown when the search query matches no project. */
  noResultsLabel: string;
  /** Message shown alongside the retry action when loading failed. */
  errorLabel: string;
  /** Message shown with a retry action when some sources could not be listed in full. */
  incompleteLabel: string;
  /** Label of the retry action shown when loading failed. */
  retryLabel: string;
  /** Text of the source badge for each project source. */
  sourceLabels: Record<ProjectSource, string>;
  /** Announced through the status region when projects are listed, e.g. "3 projects". */
  resultCountLabel: (count: number) => string;
}

/**
 * Color overrides for the {@link Projects} component, applied as CSS custom
 * properties with app theme fallbacks.
 */
export interface ProjectsColors {
  /** Page background. Fallback: `--bg-layer-base`. */
  background?: string;
  /** Subtitle and status-message text color. Fallback: `--text-secondary`. */
  subtitleText?: string;
  /** Sort control label/icon color. Fallback: `--text-accent`. */
  sortButtonText?: string;
  /** Card background. Fallback: `--bg-layer-raised`. */
  cardBackground?: string;
  /** Card border color. Fallback: `--stroke-tertiary`. */
  cardBorder?: string;
  /** Project name color on a card. Fallback: `--text-primary`. */
  cardTitleText?: string;
  /** Source badge background. Fallback: `--bg-layer-sunken`. */
  badgeBackground?: string;
  /** Source badge text color. Fallback: `--text-primary`. */
  badgeText?: string;
  /** Last-updated date text color on a card. Fallback: `--text-secondary`. */
  metaText?: string;
}

/** Typography overrides for the {@link Projects} component. */
export interface ProjectsTypography {
  /** CSS class applied to the page title. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** CSS class applied to the subtitle and status messages. Defaults to `'dial-body-text'`. */
  subtitleClassName?: string;
  /** CSS class applied to each card's project name. Defaults to `'dial-body-semi-text'`. */
  cardTitleClassName?: string;
  /** CSS class applied to each card's source badge. Defaults to `'dial-tiny-semi-text'`. */
  badgeClassName?: string;
  /** CSS class applied to each card's last-updated date. Defaults to `'dial-small-text'`. */
  metaClassName?: string;
}

/** Style overrides for the {@link Projects} component. */
export interface ProjectsStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ProjectsColors;
  /** Typography class overrides. */
  typography?: ProjectsTypography;
}

/** Props for the {@link Projects} component. */
export interface ProjectsProps {
  /** Every project available to the user; the component filters and sorts them. */
  projects: ProjectItem[];
  /** Shows the loading state instead of the list. Defaults to `false`. */
  isLoading?: boolean;
  /** Shows the error state with a retry action. Defaults to `false`. */
  hasError?: boolean;
  /** Sources that could not be listed in full; when non-empty, a notice with a retry action is shown. Defaults to `[]`. */
  incompleteSources?: ProjectSource[];
  /** Called when the user activates the retry action. */
  onRetry: () => void;
  /** Current search query (controlled). */
  searchQuery: string;
  /** Called with the new query when the user types or clears the search. */
  onSearchQueryChange: (query: string) => void;
  /** Applied sort order (controlled). */
  sortKey: ProjectsSortKey;
  /** Called when the user picks another sort order. */
  onSortKeyChange: (sortKey: ProjectsSortKey) => void;
  /** Formats a card's last-updated time (epoch milliseconds) as display text. */
  formatUpdatedAt: (timestamp: number) => string;
  /** Localized labels. */
  labels: ProjectsLabels;
  /** BCP 47 locale used to collate names for the Name A–Z order. Defaults to the runtime locale. */
  locale?: string;
  /** Color and typography overrides. */
  styles?: ProjectsStyles;
}

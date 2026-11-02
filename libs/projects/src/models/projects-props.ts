import type { SelectOption } from '@epam/ai-dial-ui-kit';
import type { ProjectSource } from '../types/project-source';
import type { ProjectsSortKey } from '../types/projects-sort-key';
import type { ProjectItem } from './project-item';

/** Localized labels used by the {@link Projects} component. */
export interface ProjectsLabels {
  /** Page title, e.g. "All projects". */
  title: string;
  /** One-line description shown beneath the title. Omitted when not set. */
  subtitle?: string;
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
  /** Label of each project source, the first segment of a card's folder path. */
  sourceLabels: Record<ProjectSource, string>;
  /** Accessible name of a card's folder path, e.g. "Project location". */
  folderPathLabel: string;
  /** Announced through the status region when projects are listed, e.g. "3 projects". */
  resultCountLabel: (count: number) => string;
  /** Label of the header and empty-state New project buttons; required whenever `onCreateProject` is supplied. */
  createProjectLabel?: string;
  /** Visually hidden text of a pinned card's marker. Defaults to `'Pinned'`. */
  pinnedLabel?: string;
  /** Accessible name of a card's pin toggle, whose `aria-pressed` carries the state. Defaults to `'Pin'`. */
  pinLabel?: string;
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
  /** Project name color on a card. Fallback: `--text-primary`. */
  cardTitleText?: string;
  /** Relative last-updated time color on a card. Fallback: `--text-secondary`. */
  updatedAtText?: string;
  /** Folder path text color on a card. Fallback: `--text-secondary`. */
  pathText?: string;
  /** Focus outline color around a card whose link has keyboard focus. Fallback: `--stroke-focus`. */
  cardFocusOutline?: string;
}

/** Typography overrides for the {@link Projects} component. */
export interface ProjectsTypography {
  /** CSS class applied to the page title. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** CSS class applied to the subtitle and status messages. Defaults to `'dial-body-text'`. */
  subtitleClassName?: string;
  /** CSS class applied to each card's project name. Defaults to `'dial-body-semi-text'`. */
  cardTitleClassName?: string;
  /** CSS class applied to the non-leaf folder path segments. Defaults to `'dial-tiny-text'`. */
  pathLabelClassName?: string;
  /** CSS class applied to the last folder path segment. Defaults to `'dial-tiny-semi-text'`. */
  pathLeafClassName?: string;
  /** CSS class applied to each card's relative last-updated time. Defaults to `'dial-tiny-text'`. */
  updatedAtClassName?: string;
  /** CSS class applied to the empty state's description. Defaults to `'dial-small-paragraph-text'`. */
  emptyStateDescriptionClassName?: string;
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
  /** Called from the New project buttons; the buttons are not rendered when omitted. */
  onCreateProject?: () => void;
  /** Called from a card's pin toggle with the project id and its new pinned state; without it, a pinned card shows a static marker instead. */
  onTogglePin?: (id: string, isPinned: boolean) => void;
  /** Called with a project id on a plain primary click of a card link, in place of the browser's navigation; ignored without `getProjectHref`. */
  onOpenProject?: (id: string) => void;
  /** URL of a project's page, used as each card link's `href`; cards are not interactive when omitted. */
  getProjectHref?: (id: string) => string;
  /** Current search query (controlled). */
  searchQuery: string;
  /** Called with the new query when the user types or clears the search. */
  onSearchQueryChange: (query: string) => void;
  /** Applied sort order (controlled). */
  sortKey: ProjectsSortKey;
  /** Called when the user picks another sort order. */
  onSortKeyChange: (sortKey: ProjectsSortKey) => void;
  /** Localized labels. */
  labels: ProjectsLabels;
  /** BCP 47 locale used to collate names for the Name A–Z order. Defaults to the runtime locale. */
  locale?: string;
  /** Color and typography overrides. */
  styles?: ProjectsStyles;
}

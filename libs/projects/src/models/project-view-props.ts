/** One file of a project's context, as the {@link ProjectView} renders it. */
export interface ProjectContextFileItem {
  /** File name under the project's context folder. */
  name: string;
  /** MIME type, used for the card's type icon. */
  contentType: string;
}

/** The project content the {@link ProjectView} renders. */
export interface ProjectViewModel {
  /** Project name. */
  name: string;
  /** Plain-text description; the section is omitted when empty. */
  description: string;
  /** Markdown instructions; the section is omitted when empty. */
  instructions: string;
  /** Context files, in display order. */
  contextFiles: ProjectContextFileItem[];
}

/** Localized labels used by the {@link ProjectView} component. */
export interface ProjectViewLabels {
  /** Accessible name of the back button. */
  backLabel: string;
  /** Accessible name of the Pin toggle; its state is announced through `aria-pressed`. */
  pinLabel: string;
  /** Publish action label. */
  publishLabel: string;
  /** Edit action label. */
  editLabel: string;
  /** Accessible name of the more-actions menu trigger. */
  moreActionsLabel: string;
  /** Share action label. */
  shareLabel: string;
  /** Download action label. */
  downloadLabel: string;
  /** Delete action label. */
  deleteLabel: string;
  /** Heading and accessible name of the Details panel. */
  detailsLabel: string;
  /** Description section heading. */
  descriptionLabel: string;
  /** Instructions section heading. */
  instructionsLabel: string;
  /** Context section heading. */
  contextLabel: string;
  /** Placeholder of the context search input. */
  contextSearchPlaceholder: string;
  /** Accessible name of the context search input. */
  contextSearchAriaLabel: string;
  /** Accessible name of the search input's clear action. */
  clearSearchLabel: string;
  /** Announced while a context query is active, e.g. "2 files found". */
  contextResultCountLabel: (count: number) => string;
  /** Shown when the project has no context files. */
  emptyContextLabel: string;
  /** Shown when the context query matches no file. */
  noContextMatchesLabel: string;
  /** Accessible name of a context file card, e.g. "Download tickets.csv". */
  openFileLabel: (name: string) => string;
  /** Shown when the project could not be loaded. */
  errorLabel: string;
  /** Retry action label. */
  retryLabel: string;
  /** Shown when the project does not exist. */
  notFoundLabel: string;
  /** Label of the action that returns to the projects list. */
  browseProjectsLabel: string;
}

/**
 * Color overrides for the {@link ProjectView} component, applied as CSS
 * custom properties with app theme fallbacks.
 */
export interface ProjectViewColors {
  /** Page background. Fallback: `--bg-layer-base`. */
  background?: string;
  /** Header border and the Details panel's inline-start border. Fallback: `--stroke-tertiary`. */
  border?: string;
  /** The project name and the Details heading. Fallback: `--text-primary`. */
  headingText?: string;
  /** Description and instructions text. Fallback: `--text-primary`. */
  bodyText?: string;
  /** Section labels, status and helper text. Fallback: `--text-secondary`. */
  secondaryText?: string;
}

/** Typography overrides for the {@link ProjectView} component. */
export interface ProjectViewTypography {
  /** CSS class applied to the project name. Defaults to `'dial-h2-text'`. */
  titleClassName?: string;
  /** CSS class applied to the Details panel heading. Defaults to `'dial-body-semi-text'`. */
  panelTitleClassName?: string;
  /** CSS class applied to the Description, Instructions and Context labels. Defaults to `'dial-tiny-text'`. */
  sectionTitleClassName?: string;
  /** CSS class applied to the description and instructions. Defaults to `'dial-small-text'`. */
  bodyClassName?: string;
  /** CSS class applied to the status text. Defaults to `'dial-tiny-text'`. */
  helperClassName?: string;
  /** CSS class applied to every markdown heading inside the instructions. Defaults to `'dial-small-semi-text'`. */
  instructionsHeadingClassName?: string;
}

/** Style overrides for the {@link ProjectView} component. */
export interface ProjectViewStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: ProjectViewColors;
  /** Typography class overrides. */
  typography?: ProjectViewTypography;
}

/** Props for the {@link ProjectView} component. */
export interface ProjectViewProps {
  /** The loaded project, or `null` while loading or after a failure. */
  project: ProjectViewModel | null;
  /** Shows the loading state. Defaults to `false`. */
  isLoading?: boolean;
  /** Shows the error state with a retry action. Defaults to `false`. */
  hasError?: boolean;
  /** Shows the not-found state. Defaults to `false`. */
  isNotFound?: boolean;
  /** Whether the project is pinned. */
  isPinned: boolean;
  /** Ignores Pin toggle activations while a pin change is saved; the toggle stays focusable. Defaults to `false`. */
  isPinPending?: boolean;
  /** Context search query (controlled). */
  contextSearchQuery: string;
  /** Called with the new query when the user types or clears the context search. */
  onContextSearchQueryChange: (query: string) => void;
  /** Called when the user activates the back button. */
  onBack: () => void;
  /** Called when the user toggles Pin. */
  onTogglePin: () => void;
  /** Called from the Publish action; the action is hidden when omitted. */
  onPublish?: () => void;
  /** Called from the Edit action; the action is hidden when omitted. */
  onEdit?: () => void;
  /** Called from the Share action; the action is hidden when omitted. */
  onShare?: () => void;
  /** Called from the Delete action; the action is hidden when omitted. */
  onDelete?: () => void;
  /** Called from the Download action. */
  onDownload: () => void;
  /** Called with a file name when the user activates its context card. */
  onOpenFile: (fileName: string) => void;
  /** Called from the retry action of the error state. */
  onRetry: () => void;
  /** Called from the not-found state's action. */
  onBrowseProjects: () => void;
  /** Localized labels. */
  labels: ProjectViewLabels;
  /** Color and typography overrides. */
  styles?: ProjectViewStyles;
}

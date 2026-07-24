import type { ScheduledTaskItem } from './scheduled-task-item';

/** A single sort option shown in the Scheduled Tasks toolbar sort control. */
export interface ScheduledTasksSortOption {
  /** Stable identifier for this sort option, passed back via `onSortChange`. */
  key: string;
  /** Localized display label for this sort option. */
  label: string;
}

/** Localized text strings used by the {@link ScheduledTasks} component. */
export interface ScheduledTasksTexts {
  /** Page title, e.g. "Scheduled tasks". */
  title: string;
  /** One-line description shown beneath the title. */
  subtitle: string;
  /** Label for the primary "create task" action button. */
  createButtonLabel: string;
  /** Placeholder text for the toolbar search input. */
  searchPlaceholder: string;
  /** Accessible label for the toolbar search input. */
  searchAriaLabel: string;
  /** Accessible label for the toolbar search input's clear action. */
  clearSearchLabel: string;
  /** Accessible label for the toolbar sort control. */
  sortLabel: string;
  /** Options rendered in the sort control's dropdown. */
  sortOptions: ScheduledTasksSortOption[];
  /** Message shown when the fetched task list is empty. */
  emptyStateLabel: string;
  /** Message shown when `searchQuery` filters every task out. */
  noResultsLabel: string;
  /** Message shown alongside the retry action when `error` is set. */
  errorLabel: string;
  /** Label for the retry action shown when `error` is set. */
  retryLabel: string;
  /** Title for the section grouping items with `sectionKey: 'shared'`. */
  sharedSectionTitle: string;
  /** Title for the section grouping items with `sectionKey: 'myTasks'`. */
  myTasksSectionTitle: string;
  /** Label shown in a card's "new" badge. */
  cardNewBadgeLabel?: string;
  /** Accessible label for a card's overflow-menu trigger. */
  cardActionsLabel?: string;
  /** Label for the "Edit" card menu action. */
  cardEditActionLabel?: string;
  /** Label for the "Run now" card menu action. */
  cardRunNowActionLabel?: string;
  /** Label for the "Delete" card menu action. */
  cardDeleteActionLabel?: string;
}

/** Style overrides for the {@link ScheduledTasks} component. */
export interface ScheduledTasksStyles {
  /** CSS class applied to the root container's background. Defaults to `'bg-layer-5'`. */
  containerClassName?: string;
  /** CSS class applied to the title. Defaults to `'dial-h1-text'`. */
  titleClassName?: string;
  /** CSS class applied to the subtitle. Defaults to `'dial-body-text text-secondary'`. */
  subtitleClassName?: string;
  /** CSS class applied to the sort control's label and icons. Defaults to `'text-accent-primary'`. */
  sortButtonClassName?: string;
  /** Size (px) of the empty-state icon. Defaults to `48`. */
  emptyStateIconSize?: number;
}

/** Props for the {@link ScheduledTasks} component. */
export interface ScheduledTasksProps {
  /** Localized text strings. */
  texts: ScheduledTasksTexts;
  /** Called when the user activates the primary "create task" action. */
  onCreateClick: () => void;
  /** Current value of the toolbar search input. */
  searchQuery: string;
  /** Called when the toolbar search input value changes. */
  onSearchQueryChange: (query: string) => void;
  /** Key of the currently selected sort option. */
  sortKey: string;
  /** Called when the user selects a different sort option. */
  onSortChange: (key: string) => void;
  /** Fetched tasks to render as cards, grouped by `sectionKey` and sorted by `sortKey`. */
  items: ScheduledTaskItem[];
  /** When `true`, the content region shows a loading spinner instead of `items`. Defaults to `false`. */
  isLoading?: boolean;
  /** When set, the content region shows an error message and retry action instead of `items`. */
  error?: Error | null;
  /** Called when the user activates the retry action shown alongside `error`. */
  onRetry?: () => void;
  /** Called with a task id when the user activates "Edit" on a card. Omit to hide the action on every card. */
  onEdit?: (id: string) => void;
  /** Called with a task id when the user activates "Run now" on a card. Omit to hide the action on every card. */
  onRunNow?: (id: string) => void;
  /** Called with a task id when the user activates "Delete" on a card. Omit to hide the action on every card. */
  onDelete?: (id: string) => void;
  /** Style overrides. */
  styles?: ScheduledTasksStyles;
}

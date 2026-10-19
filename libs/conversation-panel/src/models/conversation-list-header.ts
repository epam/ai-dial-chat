import type { FilterTab } from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';
import type { FilterLabels } from './panel-props';

/** Localised labels for `ConversationListHeader`. */
export interface ConversationListHeaderLabels {
  /** Visible heading, rendered uppercase by its typography class. */
  title: string;
  /** Accessible name of the button that opens the search field. */
  searchOpenLabel: string;
  /** Accessible name of the button that closes the search field. */
  searchCloseLabel: string;
  /** Placeholder and accessible name of the search field. */
  searchPlaceholder: string;
  /** Accessible name of the search field's clear button. */
  searchClearLabel: string;
  /** Labels of the filter options; `groupAriaLabel` names the filter trigger. */
  filterLabels: FilterLabels;
}

/** Color overrides for `ConversationListHeader`, applied as CSS custom properties on its root. */
export interface ConversationListHeaderColors {
  /** Title color at rest and on hover. Defaults to `--text-secondary`. */
  title?: string;
  /** Title color while the title button has keyboard focus. Defaults to `--text-primary`. */
  titleFocus?: string;
}

/** Typography overrides for `ConversationListHeader`. */
export interface ConversationListHeaderTypography {
  /** Typography class applied to the title. Defaults to `'dial-tiny-lead-semi-text'`. */
  titleClassName?: string;
  /** Typography class applied to the search field text. Defaults to `'dial-tiny-text'`. */
  searchTextClassName?: string;
}

/** Style overrides for `ConversationListHeader`. */
export interface ConversationListHeaderStyles {
  /** Color overrides for the title. */
  colors?: ConversationListHeaderColors;
  /** Typography overrides for the title and the search field. */
  typography?: ConversationListHeaderTypography;
}

/** Props accepted by `ConversationListHeader`. */
export interface ConversationListHeaderProps {
  /** Localised labels for the header. */
  labels: ConversationListHeaderLabels;
  /** Whether the list under the header is expanded; drives the title's `aria-expanded`. Defaults to `true`. */
  isExpanded?: boolean;
  /** Called when the title is activated. When absent the title is plain text, not a button. */
  onToggleExpanded?: () => void;
  /** `id` of the element the title controls, referenced through `aria-controls`. */
  controlsId?: string;
  /** Current search text. Defaults to `''`. */
  searchQuery?: string;
  /** Whether the search field replaces the header row. Defaults to `false`. */
  isSearchOpen?: boolean;
  /** Called with the search text on every edit and with `''` when the search closes. The search control renders only when this and `onSearchOpenChange` are both provided. */
  onSearchChange?: (query: string) => void;
  /** Called when the search field opens or closes. */
  onSearchOpenChange?: (isOpen: boolean) => void;
  /** Filter tab marked as chosen in the filter menu. Defaults to `FilterTab.All`. */
  activeFilter?: FilterTab;
  /** Called when a filter option is chosen. The filter trigger renders only when this is provided. */
  onFilterChange?: (tab: FilterTab) => void;
  /** Filter options to omit from the menu (see `ConversationListProps.hiddenSources`). */
  hiddenSources?: FilterTab[];
  /** Extra controls rendered after the filter trigger, e.g. an overflow menu. */
  actions?: ReactNode;
  /** Color and typography overrides. */
  styles?: ConversationListHeaderStyles;
  /** Extra class name(s) merged onto the header root. */
  className?: string;
}

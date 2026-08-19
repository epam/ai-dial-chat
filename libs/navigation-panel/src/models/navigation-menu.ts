import type { ReactNode } from 'react';

/** One selectable value inside a settings group (a language, a theme, a shortcut). */
export interface NavigationMenuOption {
  /** Stable identity used as the React key. */
  id: string;
  /** Translated option label. */
  label: string;
  /** Whether this option is the currently applied value; renders a check mark. */
  isActive: boolean;
  /** Optional leading icon. */
  icon?: ReactNode;
  /** Applies the option. */
  onSelect: () => void;
}

/**
 * A single-select settings group rendered as a submenu on desktop and as a
 * pushed sheet page on mobile.
 */
export interface NavigationMenuGroup {
  /** Stable identity used as the React key. */
  id: string;
  /** Translated group label shown on the parent row and as the sheet page title. */
  label: string;
  /** Optional leading icon for the parent row. */
  icon?: ReactNode;
  /** Options belonging to the group; a group with no options is skipped. */
  options: NavigationMenuOption[];
}

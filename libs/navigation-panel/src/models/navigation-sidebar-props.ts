import type { CSSProperties, ReactNode } from 'react';
import type { NavigationSidebarVariant } from '../types/navigation-sidebar-variant';
import type {
  NavigationSidebarLinkRenderer,
  NavigationPanelItem,
} from './navigation-item';
import type { NavigationPanelLogo } from './navigation-panel-props';

/** Brand mark of `NavigationSidebar`, already resolved by the host; `iconUrl` is the square mark shown while collapsed. */
export interface NavigationSidebarLogo extends NavigationPanelLogo {
  /** Wide logo shown while expanded and in the drawer. When omitted, `iconUrl` is shown in every state. */
  logoUrl?: string;
}

/** Translated labels required by `NavigationSidebar`. */
export interface NavigationSidebarLabels {
  /** Accessible name for the `<nav>` landmark. */
  ariaLabel: string;
  /** Accessible name of the collapse toggle, the same in both states; `aria-expanded` reports the state. Defaults to `'Sidebar'`. */
  toggle?: string;
  /** Tooltip of the toggle while the sidebar is expanded. Defaults to `'Collapse sidebar'`. */
  collapse?: string;
  /** Tooltip of the toggle while the sidebar is collapsed. Defaults to `'Expand sidebar'`. */
  expand?: string;
  /** Accessible name and tooltip of the drawer's close button. Defaults to `'Close'`. */
  close?: string;
}

/** CSS custom-property overrides for `NavigationSidebar`. */
export interface NavigationSidebarColors {
  /** Sidebar background. Defaults to `--bg-layer-raised`. */
  background?: string;
  /** Text and icon color of an inactive item. Defaults to `--text-primary`. */
  itemText?: string;
  /** Item background on hover and keyboard focus. Defaults to `--bg-control-accent-alpha-hover-subtle`. */
  itemHoverBackground?: string;
  /** Background of the active item. Defaults to `--bg-control-accent-alpha-active-subtle`. */
  itemSelectedBackground?: string;
  /** Icon paint of the active item; replaces the built-in gradient. Defaults to a blue-to-violet gradient. */
  itemActiveIcon?: string;
  /** First color of the built-in active-icon gradient. Defaults to `#1d4ed8`. */
  itemActiveGradientStart?: string;
  /** Last color of the built-in active-icon gradient. Defaults to `#885df2`. */
  itemActiveGradientEnd?: string;
  /** Keyboard focus ring color of an item. Defaults to `--stroke-focus`. */
  focusOutline?: string;
}

/** Typography overrides for `NavigationSidebar`. */
export interface NavigationSidebarTypography {
  /** CSS class applied to item labels. Defaults to `'dial-small-text'`. */
  fontClassName?: string;
  /** `font-family` applied to the sidebar root. */
  fontFamily?: string;
}

/** Combined style overrides for `NavigationSidebar`. */
export interface NavigationSidebarStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: NavigationSidebarColors;
  /** Typography overrides. */
  typography?: NavigationSidebarTypography;
  /** Extra class name(s) merged onto the `<nav>` element. */
  className?: string;
  /** CSS custom properties applied to the `<nav>` element. */
  cssVars?: CSSProperties;
}

/** Props accepted by `NavigationSidebar`. */
export interface NavigationSidebarProps {
  /** Destinations rendered as rows (expanded and drawer) or icon buttons (collapsed), in display order. */
  items: NavigationPanelItem[];
  /** Translated labels for the landmark and the toggle. */
  labels: NavigationSidebarLabels;
  /** Layout of the sidebar. Defaults to `NavigationSidebarVariant.Sidebar`. */
  variant?: NavigationSidebarVariant;
  /** Whether the sidebar is collapsed to its icon-only width. Ignored by the drawer. Defaults to `false`. */
  isCollapsed?: boolean;
  /** Called when the toggle is activated. When absent no toggle renders. Not used by the drawer. */
  onToggleCollapse?: () => void;
  /** Whether the drawer is shown; while it is not, it is slid out of view, `inert` and `invisible`. Drawer only. Defaults to `false`. */
  isOpen?: boolean;
  /** Called when the drawer's close button is activated or Escape is pressed inside it. When absent the drawer renders no close button. Drawer only. */
  onClose?: () => void;
  /** `id` of the `<nav>`, referenced by an opener's `aria-controls`. Defaults to a generated id. */
  id?: string;
  /** Brand mark; omit to render no logo. */
  logo?: NavigationSidebarLogo;
  /** Renders each item as a host-owned link element, spreading the given link props onto it. Defaults to a plain `<a href>`. */
  renderLink?: NavigationSidebarLinkRenderer;
  /** Content between the items and the footer — typically the conversation list. It stays mounted but inert and hidden while collapsed. */
  children?: ReactNode;
  /** Pinned to the footer's inline start while expanded and below the actions while collapsed — typically `UserMenu`. */
  userMenu?: ReactNode;
  /** Pinned to the footer's inline end while expanded and above the user menu while collapsed. */
  footerActions?: ReactNode;
  /** Style overrides for colors, typography, and class names. */
  styles?: NavigationSidebarStyles;
}

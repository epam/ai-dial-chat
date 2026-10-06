import type { CSSProperties, ReactNode } from 'react';
import type {
  NavigationLinkRenderer,
  NavigationPanelItem,
} from './navigation-item';

/** Brand mark rendered above the nav items, already resolved by the host. */
export interface NavigationPanelLogo {
  /** Image URL used as the mark's `background-image`. */
  iconUrl: string;
  /** Link target for the mark. Defaults to `'/'`. */
  href?: string;
  /** Translated accessible name for the logo link. */
  ariaLabel: string;
}

/** CSS custom-property overrides for `NavigationPanel`. */
export interface NavigationPanelColors {
  /** Rail background color. */
  background?: string;
  /** Icon color of an inactive item. Defaults to `--text-primary`. */
  itemText?: string;
  /** Icon color of the active item; also its keyboard-focus ring. */
  itemActiveText?: string;
  /** Background of the active/selected item. Defaults to `--bg-control-accent-alpha-active`. */
  itemSelectedBackground?: string;
  /** Icon paint of the active item: `fill` for an `activeIcon`, `fill` plus `stroke` for an outline `icon` without one. Defaults to a built-in blue-to-violet gradient. */
  itemActiveIcon?: string;
  /** Item background on hover and keyboard focus. Defaults to `transparent` on hover and `--bg-control-accent-alpha-hover` on focus. */
  itemHoverBackground?: string;
  /** Icon `stroke` paint on hover and keyboard focus. Defaults to a built-in blue-to-violet gradient. */
  itemHoverIcon?: string;
  /** Item background while pressed. */
  itemActiveBackground?: string;
}

/** Typography overrides for `NavigationPanel`. */
export interface NavigationPanelTypography {
  /** CSS class applied to the rail root, inherited by all rail content. */
  fontClassName?: string;
  /** `font-family` applied to the rail root. */
  fontFamily?: string;
}

/** Combined style overrides for `NavigationPanel`. */
export interface NavigationPanelStyles {
  /** Color overrides applied as CSS custom properties. */
  colors?: NavigationPanelColors;
  /** Typography overrides applied to the rail root. */
  typography?: NavigationPanelTypography;
  /** Extra class name(s) merged onto the `<nav>` element. */
  className?: string;
  /** CSS custom properties applied to the `<nav>` element. */
  cssVars?: CSSProperties;
}

/** Translated labels required by `NavigationPanel`. */
export interface NavigationPanelLabels {
  /** Accessible name for the `<nav>` landmark. */
  ariaLabel: string;
}

/** Props accepted by `NavigationPanel`. */
export interface NavigationPanelProps {
  /** Destinations rendered as icon buttons, in display order. */
  items: NavigationPanelItem[];
  /** Translated labels for the landmark. */
  labels: NavigationPanelLabels;
  /** Brand mark shown above the items; omit to render no logo. */
  logo?: NavigationPanelLogo;
  /** Pinned to the bottom of the rail — typically `UserMenu`. */
  footer?: ReactNode;
  /** Wraps each item in a host-owned link element. Defaults to a plain `<a href>`. */
  renderLink?: NavigationLinkRenderer;
  /** Style overrides for colors, typography, and class names. */
  styles?: NavigationPanelStyles;
}

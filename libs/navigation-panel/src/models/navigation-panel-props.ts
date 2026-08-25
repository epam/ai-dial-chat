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
  /** Icon color of an inactive item. */
  itemText?: string;
  /** Icon color of the active item. */
  itemActiveText?: string;
  /** Item background on hover. */
  itemHoverBackground?: string;
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

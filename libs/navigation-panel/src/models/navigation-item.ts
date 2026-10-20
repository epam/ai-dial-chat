import type { FC, ReactNode } from 'react';

/**
 * Icon component contract shared by the nav rail and the mobile sheet rows.
 * Matches the `@tabler/icons-react` signature so host icons drop in directly.
 */
export type NavigationItemIcon = FC<{ size?: number; stroke?: number }>;

/** A single primary-navigation destination, already resolved by the host. */
export interface NavigationPanelItem {
  /** Stable identity used as the React key and as the `onSelect` discriminator. */
  id: string;
  /** Translated label used as the accessible name, tooltip, and sheet row text. */
  label: string;
  /** Icon component rendered inside the rail button and the sheet row. */
  icon: NavigationItemIcon;
  /** Filled icon the rail and the sheet row render in place of `icon` while the item is active, painted with the selected-state fill. When omitted, both fill the outline `icon` itself (fill plus stroke). */
  activeIcon?: NavigationItemIcon;
  /** Whether this entry points at the page currently on screen. */
  isActive?: boolean;
  /** Target URL placed on the rail anchor. The host owns route matching and navigation. */
  href?: string;
}

/**
 * Wraps a rail item in a host-owned link element (e.g. a router `Link`) so the
 * lib never imports a routing library. Defaults to a plain `<a href>`.
 */
export type NavigationLinkRenderer = (
  item: NavigationPanelItem,
  children: ReactNode,
) => ReactNode;

/** What a host's link element must carry for `NavigationSidebar` to style it and mark the current page. */
export interface NavigationSidebarLinkProps {
  /** Class names that give the link the sidebar item's box, states and focus ring. */
  className: string;
  /** `'page'` while the item points at the page on screen. */
  'aria-current'?: 'page';
}

/**
 * Renders a `NavigationSidebar` item as the host's link element (e.g. a router
 * `Link`), spreading `linkProps` onto it. The link itself is the item: it
 * holds the icon and the label, so no control is nested inside it. Defaults to
 * a plain `<a href>`.
 */
export type NavigationSidebarLinkRenderer = (
  item: NavigationPanelItem,
  children: ReactNode,
  linkProps: NavigationSidebarLinkProps,
) => ReactNode;

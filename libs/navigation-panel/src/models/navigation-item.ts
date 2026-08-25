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

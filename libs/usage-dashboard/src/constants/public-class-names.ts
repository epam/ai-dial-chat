/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the usage cards through these instead of hashed CSS-module
 * locals, DOM order, or ARIA attributes — a card's `aria-label` is built from
 * its title and period, so it was never a selector. They carry no declarations
 * of their own; they exist only as stable selectors.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const USAGE_DASHBOARD_CLASS = {
  /** One usage-limit card, which carries the themed CSS variables. */
  card: 'dial-usage-dashboard-card',
  /** The responsive grid a `UsageLimitCardGroup` lays its cards out in. */
  cardGroup: 'dial-usage-dashboard-card-group',
} as const;

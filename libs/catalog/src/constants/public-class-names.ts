/*
 * Public, host-addressable class names — part of this package's public API.
 *
 * Hosts style the catalog through these instead of hashed CSS-module locals,
 * DOM order, or ARIA attributes — a card's `aria-label` is the item's own name,
 * so it was never a selector. They carry no declarations of their own; they
 * exist only as stable selectors.
 *
 * The set is deliberately the catalog's layout skeleton rather than one class
 * per component: the root, the toolbar, the two card kinds, and the list view's
 * box. Everything inside a card is reached by descending from the card's class,
 * which keeps the contract small enough to stay honest as the catalog's
 * internals change.
 *
 * The virtualised grid box inside `CardGrid` has no class on purpose. It is a
 * positioning artifact whose height is computed per scroll frame, so a host
 * styling it would be fighting the virtualizer rather than the design — style
 * the cards, or the root, instead.
 *
 * Read the "Public class names" section of openspec/lib-styling-guide.md before
 * renaming one or moving it to a different element — both are breaking changes.
 */
export const CATALOG_CLASS = {
  /** The catalog's `section` root, which carries the themed CSS variables. */
  root: 'dial-catalog-root',
  /** The toolbar above the results: title row, search, sort, and view toggle. */
  toolbar: 'dial-catalog-toolbar',
  /**
   * One grid card, additive to the `dial-kit-card-shell` that
   * `@epam/ai-dial-ui-kit` draws. Present on a featured and on a selected card
   * too — neither state replaces it.
   */
  card: 'dial-catalog-card',
  /** One favorites card, likewise additive to `dial-kit-card-shell`. */
  favoriteCard: 'dial-catalog-favorite-card',
  /**
   * The list view's root: the bordered box around its rows, or the centred box
   * holding the empty state when there are none. A host sizing or framing the
   * region gets the same selector either way.
   */
  listView: 'dial-catalog-list-view',
} as const;

/** How many `ListView` rows a user can select. */
export enum CatalogSelectionMode {
  /** One row is highlighted through `selectedItemId`. */
  Single = 'single',
  /** Every row has a checkbox, and the host owns the selected set. */
  Multiple = 'multiple',
}

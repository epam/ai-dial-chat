import { createContext, useContext } from 'react';
import type { CatalogItem } from '../../models/catalog-item';

/** Multi-select state shared by the `ListView` selection column's header and cells. */
export interface ListSelectionContextValue {
  /** Ids of the selected items, in selection order. */
  selectedIds: ReadonlySet<string>;
  /** Whether every listed item is selected. */
  isAllSelected: boolean;
  /** Whether some, but not all, listed items are selected. */
  isSomeSelected: boolean;
  /** Whether the list has any items to select. */
  hasItems: boolean;
  /** Toggles one item's selection. */
  toggle: (id: string) => void;
  /** Selects every listed item, or clears them all when they are all selected. */
  toggleAll: () => void;
  /** Accessible name of a row's checkbox. */
  getRowAriaLabel: (item: CatalogItem) => string;
  /** Accessible name of the select-all checkbox. */
  selectAllAriaLabel: string;
}

/*
 * AG Grid React renders header and cell components as portals inside its own
 * React tree, so this context reaches them and re-renders the checkboxes on a
 * selection change without touching the column definitions or grid options.
 */
export const ListSelectionContext =
  createContext<ListSelectionContextValue | null>(null);

/** Reads the `ListView` multi-select state; only valid inside the selection column. */
export const useListSelection = (): ListSelectionContextValue => {
  const value = useContext(ListSelectionContext);
  if (value == null) {
    throw new Error(
      'useListSelection must be used inside a ListView in multiple selection mode.',
    );
  }
  return value;
};

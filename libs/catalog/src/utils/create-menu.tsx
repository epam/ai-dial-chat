import { DropdownItem, Highlight } from '@epam/ai-dial-ui-kit';
import type { MouseEvent } from 'react';
import type {
  CatalogCreateSearch,
  CatalogTabCreateMenu,
} from '../models/catalog-props';

/** Returns `items` with every string label, nested ones included, rendered through a single-line `Highlight` for `query`. */
export const highlightDropdownLabels = (
  items: DropdownItem[],
  query: string,
): DropdownItem[] =>
  items.map((item) => ({
    ...item,
    label:
      typeof item.label === 'string' ? (
        <Highlight text={item.label} query={query} maxLines={1} />
      ) : (
        item.label
      ),
    children: item.children
      ? highlightDropdownLabels(item.children, query)
      : undefined,
  }));

/** Create-button wiring derived from one tab's Create menu. */
export interface TabCreateButtonConfig {
  /** Options for a dropdown, or `undefined` when the button runs `onClick` directly. */
  options?: DropdownItem[];
  /** Runs the lone option, set only when the menu has exactly one leaf option. */
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Search field of the menu, when the tab offers one. */
  search?: CatalogCreateSearch;
}

/** Returns how the Create button should act for `menu`, or `undefined` when the tab offers nothing to create. */
export const getTabCreateButtonConfig = (
  menu: CatalogTabCreateMenu | undefined,
): TabCreateButtonConfig | undefined => {
  if (menu == null || menu.options.length === 0) return undefined;
  const [onlyOption] = menu.options;
  if (
    menu.options.length === 1 &&
    menu.search == null &&
    !onlyOption.children?.length
  ) {
    /* `options`/`search` are set explicitly so they override the header's
       full menu when this config is spread over the header's button props. */
    return {
      options: undefined,
      search: undefined,
      onClick: (event) =>
        onlyOption.onClick?.({ key: onlyOption.key, domEvent: event }),
    };
  }
  return { options: menu.options, search: menu.search };
};

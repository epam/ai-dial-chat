import { DropdownItem, Highlight } from '@epam/ai-dial-ui-kit';

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

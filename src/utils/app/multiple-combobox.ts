export function getFilteredItems<T>(
  items: T[],
  inputValue: string | undefined,
  getItemLabel: (item: T) => string,
  selectedItems?: T[],
) {
  if (!selectedItems) {
    return items;
  } else {
    const lowerCasedInputValue = inputValue ? inputValue.toLowerCase() : '';
    return items.filter(
      (item) =>
        !selectedItems.includes(item) &&
        getItemLabel(item).toLowerCase().includes(lowerCasedInputValue),
    );
  }
}

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultipleComboBox } from '../MultipleComboBox';

describe('MultipleComboBox', () => {
interface TestItem{
    id: number;
    label: string;
}
  const items: TestItem[] = [
    { id: 1, label: 'Item 1' },
    { id: 2, label: 'Item 2' },
    { id: 3, label: 'Item 3' },
  ];

  const filterLabel = 'Filter';
const placeholder = 'placeholder';

  const getItemLabel = (item:TestItem) => item.label;
  const getItemValue = (item:TestItem) => item.id.toString();
  const getFilteredItems = vi.fn((items: TestItem[], inputValue: string | undefined,getItemLabel: (item: TestItem) => string, selectedItems?: TestItem[]) =>{
    if (!selectedItems) {
        return items;
      } else {
        const lowerCasedInputValue = inputValue ? inputValue.toLowerCase() : '';
    
        return items.filter(function filterTestItems(item) {
          return (
            !selectedItems.includes(item) &&
            getItemLabel(item)
              .toLowerCase()
              .includes(lowerCasedInputValue)
          );
        });
      }
  }
);

  const onChangeSelectedItems = vi.fn();

  it('renders without crashing', () => {
    render(
      <MultipleComboBox
        items={items}
        label={filterLabel}
        placeholder={placeholder}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        getFilteredItems={getFilteredItems}
        onChangeSelectedItems={onChangeSelectedItems}
      />
    );

    expect(screen.getByText(filterLabel)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
  });

  it('renders selected items', () => {
    const selectedItems = [items[0], items[1]];
    render(
      <MultipleComboBox
        items={items}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        getFilteredItems={getFilteredItems}
        onChangeSelectedItems={onChangeSelectedItems}
        initialSelectedItems={selectedItems}
      />
    );

    selectedItems.forEach((selectedItem) => {
      expect(screen.getByText(getItemLabel(selectedItem))).toBeInTheDocument();
    });
  });

  it('filters available items based on selected items', async () => {
    const selectedItems = [items[0]];
    const filteredItems = [items[1], items[2]];
    render(
      <MultipleComboBox
        items={items}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        getFilteredItems={getFilteredItems}
        onChangeSelectedItems={onChangeSelectedItems}
        initialSelectedItems={selectedItems}
      />
    );

    await userEvent.click(screen.getByRole("combobox"));

    expect(getFilteredItems).toHaveBeenCalledWith(
      items,
      '',
      getItemLabel,
      selectedItems
    );

    filteredItems.forEach((filteredItem) => {
      expect(
        screen.queryByText(getItemLabel(filteredItem))
      ).toBeInTheDocument();
    });
  });

  it('adds selected item when an item is clicked', () => {
    render(
      <MultipleComboBox
        items={items}
        label={filterLabel}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        getFilteredItems={getFilteredItems}
        onChangeSelectedItems={onChangeSelectedItems}
      />
    );

    fireEvent.click(screen.getByText(filterLabel));

    fireEvent.click(screen.getByText(getItemLabel(items[0])));

    expect(onChangeSelectedItems).toHaveBeenCalledWith([items[0]]);
  });

  it('removes selected item when close button is clicked', () => {
    const selectedItems = [items[0], items[1]];
    render(
      <MultipleComboBox
        items={items}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        getFilteredItems={getFilteredItems}
        onChangeSelectedItems={onChangeSelectedItems}
        initialSelectedItems={selectedItems}
      />
    );

      userEvent.click(screen.getByTestId(`unselect-item-${selectedItems[0].id}`));
      expect(onChangeSelectedItems).toHaveBeenCalledTimes(1)
      expect(onChangeSelectedItems).toHaveBeenCalledWith([selectedItems[0]]);
    
  });

  it('displays not found placeholder when no available items', () => {
    getFilteredItems.mockReturnValue([]);
    render(
      <MultipleComboBox
        items={items}
        label={filterLabel}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        getFilteredItems={getFilteredItems}
        onChangeSelectedItems={onChangeSelectedItems}
      />
    );

    fireEvent.click(screen.getByText(filterLabel));

    expect(
      screen.getByText('No available items')
    ).toBeInTheDocument();
  });
});
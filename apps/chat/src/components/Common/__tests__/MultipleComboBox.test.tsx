import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import React from 'react';

import { MultipleComboBox } from '../MultipleComboBox';

describe('MultipleComboBox', () => {
  interface TestItem {
    id: number;
    label: string;
  }
  const items: TestItem[] = [
    { id: 1, label: 'Item 1' },
    { id: 2, label: 'Item 2' },
    { id: 3, label: 'Item 3' },
  ];

  const placeholder = 'placeholder';

  const getItemLabel = vi.fn((item: TestItem) => item.label);
  const getItemValue = vi.fn((item: TestItem) => item.id.toString());

  const onChangeSelectedItems = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <MultipleComboBox
        items={items}
        placeholder={placeholder}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        onChangeSelectedItems={onChangeSelectedItems}
      />,
    );

    expect(screen.getByPlaceholderText(placeholder)).toBeInTheDocument();
  });

  it('renders selected items', () => {
    const selectedItems = [items[0], items[1]];
    render(
      <MultipleComboBox
        items={items}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        onChangeSelectedItems={onChangeSelectedItems}
        initialSelectedItems={selectedItems}
      />,
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
        onChangeSelectedItems={onChangeSelectedItems}
        initialSelectedItems={selectedItems}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    filteredItems.forEach((filteredItem) => {
      expect(screen.getByText(getItemLabel(filteredItem))).toBeInTheDocument();
    });
  });

  it('adds selected item when an item is clicked', async () => {
    render(
      <MultipleComboBox
        items={items}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        onChangeSelectedItems={onChangeSelectedItems}
      />,
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText(getItemLabel(items[0])));
    expect(onChangeSelectedItems).toHaveBeenCalledWith([items[0]]);
  });

  it('adds item from the input when no items passed', async () => {
    const getItemLabel = vi.fn((item: TestItem) => item.label);
    render(
      <MultipleComboBox
        getItemLabel={getItemLabel}
        getItemValue={getItemLabel}
        onChangeSelectedItems={onChangeSelectedItems}
      />,
    );

    await userEvent.type(screen.getByRole('combobox'), 'ba{enter}');
    expect(onChangeSelectedItems).toHaveBeenCalledWith(['ba']);
  });

  it('deletes selected item when close button is clicked', async () => {
    const selectedItems = [items[0], items[1]];
    render(
      <MultipleComboBox
        items={items}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        onChangeSelectedItems={onChangeSelectedItems}
        initialSelectedItems={selectedItems}
      />,
    );

    await userEvent.click(
      screen.getByTestId(`unselect-item-${selectedItems[0].id}`),
    );
    expect(onChangeSelectedItems).toHaveBeenCalledTimes(1);
    expect(onChangeSelectedItems).toHaveBeenCalledWith([selectedItems[1]]);
  });

  it('displays not found placeholder when no available items', async () => {
    render(
      <MultipleComboBox
        items={items}
        getItemLabel={getItemLabel}
        getItemValue={getItemValue}
        onChangeSelectedItems={onChangeSelectedItems}
      />,
    );

    await userEvent.type(screen.getByRole('combobox'), 'test');
    expect(screen.getByText('No available items')).toBeInTheDocument();
  });
});

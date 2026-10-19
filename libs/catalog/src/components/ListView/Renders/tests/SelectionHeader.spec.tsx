import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ListSelectionContext,
  type ListSelectionContextValue,
} from '../../selection-context';
import { SelectionHeader } from '../SelectionHeader';

const makeContext = (
  overrides: Partial<ListSelectionContextValue> = {},
): ListSelectionContextValue => ({
  selectedIds: new Set(),
  isAllSelected: false,
  isSomeSelected: false,
  hasItems: true,
  toggle: vi.fn(),
  toggleAll: vi.fn(),
  getRowAriaLabel: (row) => `Pick ${row.name}`,
  selectAllAriaLabel: 'Pick all',
  ...overrides,
});

const renderHeader = (context: ListSelectionContextValue) =>
  render(
    <ListSelectionContext.Provider value={context}>
      <SelectionHeader />
    </ListSelectionContext.Provider>,
  );

const getSelectAll = () =>
  screen.getByRole('checkbox', { name: 'Pick all' }) as HTMLInputElement;

describe('SelectionHeader', () => {
  it('is unchecked when nothing is selected', () => {
    renderHeader(makeContext());

    expect(getSelectAll().checked).toBe(false);
    expect(getSelectAll().getAttribute('aria-checked')).not.toBe('mixed');
  });

  it('is mixed for a partial selection', () => {
    renderHeader(makeContext({ isSomeSelected: true }));

    expect(getSelectAll().getAttribute('aria-checked')).toBe('mixed');
  });

  it('is checked when every listed item is selected', () => {
    renderHeader(makeContext({ isAllSelected: true }));

    expect(getSelectAll().checked).toBe(true);
  });

  it('is disabled without items', () => {
    renderHeader(makeContext({ hasItems: false }));

    expect(getSelectAll().disabled).toBe(true);
  });

  it('toggles every listed item when activated', async () => {
    const toggleAll = vi.fn();
    renderHeader(makeContext({ toggleAll }));

    await userEvent.click(getSelectAll());

    expect(toggleAll).toHaveBeenCalledTimes(1);
  });
});

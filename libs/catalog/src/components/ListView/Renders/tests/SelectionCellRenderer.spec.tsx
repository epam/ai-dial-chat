import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ICellRendererParams } from 'ag-grid-community';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import {
  ListSelectionContext,
  type ListSelectionContextValue,
} from '../../selection-context';
import { SelectionCellRenderer } from '../SelectionCellRenderer';

const item: CatalogItem = {
  id: 'skills/public/web-search',
  type: CatalogEntityType.Skill,
  name: 'Web Search',
  version: '',
  lastUsed: '',
  description: '',
  topics: [],
  folder: [],
};

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

const renderCell = (context: ListSelectionContextValue, data?: CatalogItem) =>
  render(
    <ListSelectionContext.Provider value={context}>
      <SelectionCellRenderer
        {...({ data } as ICellRendererParams<CatalogItem>)}
      />
    </ListSelectionContext.Provider>,
  );

describe('SelectionCellRenderer', () => {
  it('reflects whether the row is selected, under the row label', () => {
    renderCell(makeContext({ selectedIds: new Set([item.id]) }), item);

    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Pick Web Search',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('toggles its row when activated', async () => {
    const toggle = vi.fn();
    renderCell(makeContext({ toggle }), item);

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Pick Web Search' }),
    );

    expect(toggle).toHaveBeenCalledWith(item.id);
  });

  it('renders nothing without row data', () => {
    renderCell(makeContext());

    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('throws outside a multi-select ListView', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      render(
        <SelectionCellRenderer
          {...({ data: item } as ICellRendererParams<CatalogItem>)}
        />,
      ),
    ).toThrow(/multiple selection mode/);
  });
});

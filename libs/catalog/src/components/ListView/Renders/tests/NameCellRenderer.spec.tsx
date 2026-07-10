import { render, screen } from '@testing-library/react';
import type { ICellRendererParams } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import type { GridContext } from '../../../../models/grid-context';
import { CatalogEntityType } from '../../../../types/entity-type';
import { NameCellRenderer } from '../NameCellRenderer';

const makeItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Model,
  name: 'Claude',
  version: '1.0',
  description: 'desc',
  topics: [],
  folder: [],
  lastUsed: '',
  ...overrides,
});

const makeParams = (
  data: CatalogItem,
  context: Partial<GridContext> = {},
): ICellRendererParams<CatalogItem, unknown, GridContext> =>
  ({
    data,
    context: { searchQuery: '', typography: {}, ...context },
  }) as ICellRendererParams<CatalogItem, unknown, GridContext>;

describe('NameCellRenderer — selected state', () => {
  it('does not render a checkmark by default', () => {
    const { container } = render(
      <NameCellRenderer {...makeParams(makeItem())} />,
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders a checkmark when the row matches selectedItemId', () => {
    const { container } = render(
      <NameCellRenderer
        {...makeParams(makeItem({ id: '1' }), { selectedItemId: '1' })}
      />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('does not render a checkmark for a different selected row', () => {
    const { container } = render(
      <NameCellRenderer
        {...makeParams(makeItem({ id: '1' }), { selectedItemId: '2' })}
      />,
    );
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('Claude')).toBeTruthy();
  });
});

import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import type { ICellRendererParams } from 'ag-grid-community';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../../../models/catalog-item';
import type { GridContext } from '../../../../models/grid-context';
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

describe('NameCellRenderer — long version', () => {
  it('caps the version at 30% of the row so it cannot overlap the name', () => {
    render(
      <NameCellRenderer
        {...makeParams(
          makeItem({ version: 'With Google Search Grounding preview' }),
        )}
      />,
    );

    const version = screen.getByText('With Google Search Grounding preview');
    expect(version.className).toContain('max-w-[30%]');
    expect(version.className).toContain('shrink-0');
  });

  it('lets the name shrink instead of being pushed out', () => {
    render(<NameCellRenderer {...makeParams(makeItem())} />);

    const heading = screen.getByText('Claude').closest('h3');
    expect(heading?.className).toContain('min-w-0');
    expect(heading?.className).toContain('shrink');
  });
});

describe('NameCellRenderer — density', () => {
  it('renders the name at the smaller dense list-view size', () => {
    render(<NameCellRenderer {...makeParams(makeItem({ name: 'Claude' }))} />);
    const heading = screen.getByText('Claude').closest('h3');
    expect(heading?.className).toContain('dial-small-semi-text');
  });

  it('never renders a description, even when the item has one', () => {
    const { container } = render(
      <NameCellRenderer {...makeParams(makeItem({ description: 'desc' }))} />,
    );
    expect(container.querySelector('p')).toBeNull();
    expect(screen.queryByText('desc')).toBeNull();
  });

  it('renders the entity tile at the dense list-view size (36px)', () => {
    const { container } = render(
      <NameCellRenderer {...makeParams(makeItem())} />,
    );
    const badge = container.querySelector(
      '[style*="width"]',
    ) as HTMLElement | null;
    expect(badge?.style.width).toBe('36px');
    expect(badge?.style.height).toBe('36px');
  });
});

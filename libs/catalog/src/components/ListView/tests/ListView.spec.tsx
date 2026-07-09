import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogEntityType } from '../../../types/entity-type';
import { ListView } from '../ListView';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  mergeClasses: (...args: (string | undefined)[]) =>
    args.filter(Boolean).join(' '),
  DialGrid: ({
    rowData,
    emptyStateTitle,
    additionalGridOptions,
    ariaLabel,
  }: {
    rowData: CatalogItem[];
    emptyStateTitle?: string;
    additionalGridOptions?: {
      context?: {
        onToggleFavorite?: (id: string, isStarred: boolean) => void;
        selectedItemId?: string;
      };
      getRowClass?: (params: { data: CatalogItem }) => string | undefined;
    };
    ariaLabel?: string;
    [key: string]: unknown;
  }) => {
    const ctx = additionalGridOptions?.context;
    return (
      <div aria-label={ariaLabel}>
        {!rowData?.length && emptyStateTitle && <span>{emptyStateTitle}</span>}
        {rowData?.map((item) => (
          <div
            key={item.id}
            data-row-class={
              additionalGridOptions?.getRowClass?.({ data: item }) ?? ''
            }
          >
            <span>{item.id === ctx?.selectedItemId ? 'selected' : ''}</span>
            <button
              aria-label={`star ${item.id}`}
              onClick={() =>
                ctx?.onToggleFavorite?.(item.id, !(item.isStarred ?? false))
              }
            />
          </div>
        ))}
      </div>
    );
  },
}));

const makeItem = (
  overrides: Partial<CatalogItem> & Pick<CatalogItem, 'id' | 'name'>,
): CatalogItem => ({
  type: CatalogEntityType.Model,
  version: '',
  lastUsed: '',
  description: '',
  topics: [],
  folder: [],
  ...overrides,
});

describe('ListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    expect(() =>
      render(
        <ListView
          items={[]}
          query=""
          ariaLabel="Catalog"
          emptyStateTitle="No items"
        />,
      ),
    ).not.toThrow();
  });

  it('shows empty state title when items array is empty', () => {
    render(
      <ListView
        items={[]}
        query=""
        ariaLabel="Catalog"
        emptyStateTitle="No items"
      />,
    );
    expect(screen.getByText('No items')).toBeTruthy();
  });

  it('calls onToggleFavorite with item id and new star state when star is toggled', async () => {
    const onToggleFavorite = vi.fn();
    const item = makeItem({ id: 'item-1', name: 'Test', isStarred: false });
    render(
      <ListView
        items={[item]}
        query=""
        ariaLabel="Catalog"
        onToggleFavorite={onToggleFavorite}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'star item-1' }));
    expect(onToggleFavorite).toHaveBeenCalledWith('item-1', true);
  });

  it('applies the selected-row class only to the row matching selectedItemId', () => {
    const item1 = makeItem({ id: 'item-1', name: 'Claude' });
    const item2 = makeItem({ id: 'item-2', name: 'Gemini' });
    const { container } = render(
      <ListView
        items={[item1, item2]}
        query=""
        ariaLabel="Catalog"
        selectedItemId="item-2"
      />,
    );

    const rows = container.querySelectorAll('[data-row-class]');
    expect(rows[0].getAttribute('data-row-class')).toBe('');
    expect(rows[1].getAttribute('data-row-class')).toBeTruthy();
  });

  it('passes selectedItemId through to the grid context', () => {
    const item = makeItem({ id: 'item-1', name: 'Claude' });
    render(
      <ListView
        items={[item]}
        query=""
        ariaLabel="Catalog"
        selectedItemId="item-1"
      />,
    );

    expect(screen.getByText('selected')).toBeTruthy();
  });
});

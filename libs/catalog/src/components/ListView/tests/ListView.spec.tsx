import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { ListView } from '../ListView';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  mergeClasses: (...args: (string | undefined)[]) =>
    args.filter(Boolean).join(' '),
  DialNoDataContent: ({ title }: { title?: string }) => <span>{title}</span>,
  Grid: ({
    rowData,
    emptyStateTitle,
    additionalGridOptions,
    ariaLabel,
    withoutHeaderBorders,
    alternateOddRowColors,
    wrapCustomCellRenderers,
  }: {
    rowData: CatalogItem[];
    emptyStateTitle?: string;
    additionalGridOptions?: {
      rowHeight?: number;
      context?: {
        onToggleFavorite?: (id: string, isStarred: boolean) => void;
        selectedItemId?: string;
      };
      getRowClass?: (params: { data: CatalogItem }) => string | undefined;
    };
    ariaLabel?: string;
    withoutHeaderBorders?: boolean;
    alternateOddRowColors?: boolean;
    wrapCustomCellRenderers?: boolean;
    [key: string]: unknown;
  }) => {
    const ctx = additionalGridOptions?.context;
    return (
      <div
        aria-label={ariaLabel}
        data-row-height={additionalGridOptions?.rowHeight}
        data-without-header-borders={String(Boolean(withoutHeaderBorders))}
        data-alternate-odd-row-colors={String(Boolean(alternateOddRowColors))}
        data-wrap-custom-cell-renderers={String(
          Boolean(wrapCustomCellRenderers),
        )}
      >
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
          type={CatalogEntityType.Model}
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
        type={CatalogEntityType.Model}
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
        type={CatalogEntityType.Model}
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
        type={CatalogEntityType.Model}
        ariaLabel="Catalog"
        selectedItemId="item-2"
      />,
    );

    // Mocked ag-grid row markup exposes the computed class only via this
    // test-only data attribute; no semantic role identifies individual rows.
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
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
        type={CatalogEntityType.Model}
        ariaLabel="Catalog"
        selectedItemId="item-1"
      />,
    );

    expect(screen.getByText('selected')).toBeTruthy();
  });

  it('uses a fixed dense row height — constant across every row regardless of content', () => {
    render(
      <ListView
        type={CatalogEntityType.Model}
        items={[makeItem({ id: 'x', name: 'x' })]}
        query=""
        ariaLabel="Catalog"
      />,
    );
    expect(
      screen.getByLabelText('Catalog').getAttribute('data-row-height'),
    ).toBe('60');
  });

  it('hands the grid a window of rows instead of the whole list', () => {
    const items = Array.from({ length: 200 }, (_, i) =>
      makeItem({ id: `item-${i}`, name: `Model ${i}` }),
    );
    const { container } = render(
      <ListView
        type={CatalogEntityType.Model}
        items={items}
        query=""
        ariaLabel="Catalog"
      />,
    );

    // Rows only exist as mocked ag-grid markup; no role identifies them.
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelectorAll('[data-row-class]')).toHaveLength(30);
  });

  it('renders every row of a list shorter than the window', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeItem({ id: `item-${i}`, name: `Model ${i}` }),
    );
    const { container } = render(
      <ListView
        type={CatalogEntityType.Model}
        items={items}
        query=""
        ariaLabel="Catalog"
      />,
    );

    // Rows only exist as mocked ag-grid markup; no role identifies them.
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelectorAll('[data-row-class]')).toHaveLength(5);
  });

  it('reserves the height of the rows outside the window', () => {
    const items = Array.from({ length: 200 }, (_, i) =>
      makeItem({ id: `item-${i}`, name: `Model ${i}` }),
    );
    const { container } = render(
      <ListView
        type={CatalogEntityType.Model}
        items={items}
        query=""
        ariaLabel="Catalog"
      />,
    );

    /* 170 unrendered rows × the 60px row height, so the page keeps the
       scroll height it would have with every row mounted. */
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    const spacer = container.querySelector('[aria-hidden][style]');
    expect(spacer?.getAttribute('style')).toContain('10200px');
  });

  it('drops the row context-menu wrapper ag-grid puts around every cell', () => {
    render(
      <ListView
        type={CatalogEntityType.Model}
        items={[makeItem({ id: 'x', name: 'x' })]}
        query=""
        ariaLabel="Catalog"
      />,
    );
    expect(
      screen
        .getByLabelText('Catalog')
        .getAttribute('data-wrap-custom-cell-renderers'),
    ).toBe('false');
  });

  it('removes ag-grid header column dividers (no vertical dividers in this view)', () => {
    render(
      <ListView
        type={CatalogEntityType.Model}
        items={[makeItem({ id: 'x', name: 'x' })]}
        query=""
        ariaLabel="Catalog"
      />,
    );
    expect(
      screen
        .getByLabelText('Catalog')
        .getAttribute('data-without-header-borders'),
    ).toBe('true');
  });

  it("does not enable ag-grid's built-in alternating row colors (zebra striping is done via CSS override instead, to avoid stacking with it)", () => {
    render(
      <ListView
        type={CatalogEntityType.Model}
        items={[makeItem({ id: 'x', name: 'x' })]}
        query=""
        ariaLabel="Catalog"
      />,
    );
    expect(
      screen
        .getByLabelText('Catalog')
        .getAttribute('data-alternate-odd-row-colors'),
    ).toBe('false');
  });
});

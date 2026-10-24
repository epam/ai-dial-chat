import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { Grid } from '@epam/ai-dial-ui-kit/grid';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOG_CLASS } from '../../../constants/public-class-names';
import type { CatalogItem } from '../../../models/catalog-item';
import { ListView } from '../ListView';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  mergeClasses: (...args: (string | undefined)[]) =>
    args.filter(Boolean).join(' '),
  NoDataContent: ({ title }: { title?: string }) => <span>{title}</span>,
}));

vi.mock('@epam/ai-dial-ui-kit/grid', () => ({
  Grid: vi.fn(
    ({
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
          {!rowData?.length && emptyStateTitle && (
            <span>{emptyStateTitle}</span>
          )}
          {rowData?.map((item) => (
            <div key={item.id} data-row>
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
  ),
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('marks only the row matching selectedItemId through the grid row selection', () => {
    render(
      <ListView
        items={[
          makeItem({ id: 'item-1', name: 'Claude' }),
          makeItem({ id: 'item-2', name: 'Gemini' }),
        ]}
        type={CatalogEntityType.Model}
        selectedItemId="item-2"
      />,
    );

    const props = vi.mocked(Grid).mock.lastCall?.[0];
    expect([...(props?.selectedRowIds ?? [])]).toEqual(['item-2']);
    expect(props?.selectionMode).toBeUndefined();
    expect(props?.additionalGridOptions?.rowSelection).toMatchObject({
      mode: 'singleRow',
      checkboxes: false,
      enableClickSelection: false,
    });
    expect(props?.additionalGridOptions?.getRowClass).toBeUndefined();
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

  it('hands the grid every item and renders no spacer rows', () => {
    const items = Array.from({ length: 200 }, (_, i) =>
      makeItem({ id: `item-${i}`, name: `Model ${i}` }),
    );
    const { container } = render(
      <ListView type={CatalogEntityType.Model} items={items} />,
    );

    const props = vi.mocked(Grid).mock.lastCall?.[0];
    expect(props?.rowData).toBe(items);
    expect(props?.additionalGridOptions?.domLayout).toBeUndefined();
    // Spacers were aria-hidden boxes sized by an inline height.
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelector('[aria-hidden][style]')).toBeNull();
  });

  it('keeps the same columns through a search and a selection, sized by flex alone', () => {
    const items = [
      makeItem({ id: 'a', name: 'Alpha' }),
      makeItem({ id: 'b', name: 'Beta' }),
    ];
    const { rerender } = render(
      <ListView type={CatalogEntityType.Model} items={items} />,
    );
    const initialProps = vi.mocked(Grid).mock.lastCall?.[0];

    rerender(
      <ListView
        type={CatalogEntityType.Model}
        items={items}
        query="al"
        selectedItemId="a"
      />,
    );

    const nextProps = vi.mocked(Grid).mock.lastCall?.[0];
    expect(nextProps?.additionalGridOptions).not.toBe(
      initialProps?.additionalGridOptions,
    );
    expect(nextProps?.columnDefs).toBe(initialProps?.columnDefs);
    // A new defaultColDef would make ag-grid rebuild the columns.
    expect(nextProps?.additionalGridOptions?.defaultColDef).toBe(
      initialProps?.additionalGridOptions?.defaultColDef,
    );
    expect(nextProps?.additionalGridOptions?.defaultColDef).toMatchObject({
      suppressSizeToFit: true,
    });
    expect(nextProps?.additionalGridOptions?.onGridSizeChanged).toBeUndefined();
  });

  it('can clear and restore results after the table has been mounted', () => {
    const items = [makeItem({ id: 'item-1', name: 'Test' })];
    const { rerender } = render(
      <ListView type={CatalogEntityType.Model} items={items} />,
    );

    rerender(
      <ListView
        type={CatalogEntityType.Model}
        items={[]}
        emptyStateTitle="No results"
      />,
    );
    expect(screen.getByText('No results')).toBeTruthy();

    rerender(<ListView type={CatalogEntityType.Model} items={items} />);
    expect(screen.getByRole('button', { name: 'star item-1' })).toBeTruthy();
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

  it('leaves row colors to the grid theme, with no zebra striping', () => {
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

  it('emits only the cell-content color variables, leaving the chrome to the grid theme', () => {
    const { container } = render(
      <ListView
        type={CatalogEntityType.Model}
        items={[makeItem({ id: 'x', name: 'x' })]}
        styles={{ colors: { folderIcon: '#7c3aed' } }}
      />,
    );

    // The variables sit on the unlabeled root box; no query reaches its style.
    // eslint-disable-next-line testing-library/no-node-access
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--cat-list-folder-icon')).toBe(
      '#7c3aed',
    );
    expect(root.getAttribute('style')).not.toContain('--cat-list-bg');
    expect(root.getAttribute('style')).not.toContain(
      '--list-header-sticky-top',
    );
  });
});

/*
 * Walking up to an unlabeled container is the only way to assert a class on it:
 * the element has no role or text of its own, and querying *by* the class would
 * still pass with the class on the wrong node.
 */
const closestWithClass = (from: Element, className: string): Element | null =>
  // eslint-disable-next-line testing-library/no-node-access -- see above
  from.closest(`.${className}`);

describe('ListView — public class names', () => {
  it('stamps the list box when there are rows', () => {
    render(
      <ListView
        items={[makeItem({ id: 'item-1', name: 'Claude' })]}
        query=""
        type={CatalogEntityType.Model}
        ariaLabel="Catalog"
      />,
    );

    /* The row's cells come from stubbed renderers; its star control is what
       this file can reach. */
    expect(
      closestWithClass(
        screen.getByRole('button', { name: 'star item-1' }),
        CATALOG_CLASS.listView,
      ),
    ).toBeTruthy();
  });

  it('stamps the empty state, which is a root of its own', () => {
    render(
      <ListView
        items={[]}
        query=""
        type={CatalogEntityType.Model}
        ariaLabel="Catalog"
        emptyStateTitle="No items"
      />,
    );

    expect(
      closestWithClass(screen.getByText('No items'), CATALOG_CLASS.listView),
    ).toBeTruthy();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogEntityType } from '../../../types/entity-type';
import { CatalogSortKey } from '../../../types/sort';
import { CatalogViewMode } from '../../../types/view-mode';
import { Catalog } from '../Catalog';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  Spinner: () => <div role="status" aria-label="Loading" />,
  DialEllipsisTooltip: ({
    text,
    className,
  }: {
    text: unknown;
    className?: string;
  }) => <span className={className}>{text as string}</span>,
  Tabs: ({
    tabs,
    activeTabId,
    onTabChange,
  }: {
    tabs: { id: string; label: React.ReactNode }[];
    activeTabId: string;
    onTabChange: (id: string) => void;
  }) => (
    <div role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTabId}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
  Dropdown: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CloseButton: ({ onClick }: { onClick: () => void }) => (
    <button aria-label="Close" onClick={onClick} />
  ),
  PrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
  }) => <button onClick={onClick}>{label}</button>,
}));
vi.mock('@tabler/icons-react', () => ({
  IconPlus: () => <svg />,
}));
vi.mock('../../Toolbar/Toolbar', () => ({
  Toolbar: ({
    title,
    query,
    onQueryChange,
    filters = new Set(),
    onFiltersChange,
    filterValues = new Set(),
    isMyAppsActive,
    onMyAppsChange,
    onViewModeChange,
    sortKey,
    sortOptions = [],
  }: {
    title?: string;
    query: string;
    onQueryChange: (q: string) => void;
    filters?: Set<string>;
    onFiltersChange?: (filters: Set<string>) => void;
    filterValues?: Set<string>;
    isMyAppsActive?: boolean;
    onMyAppsChange?: (isActive: boolean) => void;
    onViewModeChange?: (mode: string) => void;
    sortKey?: string;
    sortOptions?: { key: string; label: string; onClick?: () => void }[];
  }) => (
    <div>
      <span>{title ?? 'Browse'}</span>
      <span>{`sortKey:${sortKey}`}</span>
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="search"
      />
      {Array.from(filterValues).map((value) => (
        <button
          key={value}
          onClick={() => {
            const next = new Set(filters);
            if (next.has(value)) {
              next.delete(value);
            } else {
              next.add(value);
            }
            onFiltersChange?.(next);
          }}
        >
          {value}
        </button>
      ))}
      <button onClick={() => onMyAppsChange?.(!isMyAppsActive)}>My Apps</button>
      <button onClick={() => onViewModeChange?.('list')}>List view</button>
      {sortOptions.map((option) => (
        <button key={option.key} onClick={option.onClick}>
          Sort {option.label}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../../CardGrid/CardGrid', () => ({
  CardGrid: ({
    items,
    onItemClick,
    selectedItemId,
  }: {
    items: CatalogItem[];
    onItemClick: (item: CatalogItem) => void;
    selectedItemId?: string;
  }) => (
    <div role="grid" aria-label="catalog grid">
      {items.length} items
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onItemClick(item)}
          aria-pressed={item.id === selectedItemId}
        >
          {item.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../../Favorites/Favorites', () => ({
  Favorites: ({
    title,
    items,
    onItemClick,
    selectedItemId,
  }: {
    title?: string;
    items: CatalogItem[];
    onItemClick?: (item: CatalogItem) => void;
    selectedItemId?: string;
  }) => (
    <div>
      <span>{title ?? 'Your Favorites'}</span>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onItemClick?.(item)}
          aria-pressed={item.id === selectedItemId}
        >
          fav-{item.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../../ListView/ListView', () => ({
  ListView: ({
    items,
    onItemClick,
  }: {
    items: CatalogItem[];
    onItemClick?: (item: CatalogItem) => void;
  }) => (
    <div role="grid" aria-label="catalog list">
      {items.map((item) => (
        <button key={item.id} onClick={() => onItemClick?.(item)}>
          row-{item.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../../Details/DetailsPanel', () => ({
  DetailsPanel: ({
    item,
    isPrimaryActionVisible,
    shareOverlay,
    isDetailsLoading,
    onDownload,
    isDownloadVisible,
    onRevokeShare,
    isRevokeShareVisible,
  }: {
    item: CatalogItem;
    isPrimaryActionVisible?: (item: CatalogItem) => boolean;
    shareOverlay?: (item: CatalogItem, onClose: () => void) => React.ReactNode;
    isDetailsLoading?: boolean;
    onDownload?: (item: CatalogItem) => void;
    isDownloadVisible?: (item: CatalogItem) => boolean;
    onRevokeShare?: (item: CatalogItem) => void;
    isRevokeShareVisible?: (item: CatalogItem) => boolean;
  }) => (
    <div>
      <span>{item.name}</span>
      <span>{String(isPrimaryActionVisible?.(item))}</span>
      {onDownload && (isDownloadVisible?.(item) ?? true) && (
        <button onClick={() => onDownload(item)}>DownloadTrigger</button>
      )}
      {onRevokeShare && (isRevokeShareVisible?.(item) ?? true) && (
        <button onClick={() => onRevokeShare(item)}>RevokeShareTrigger</button>
      )}
      {shareOverlay?.(item, () => undefined)}
      <span>{`details:${JSON.stringify(item.details ?? null)}`}</span>
      <span>{`isDetailsLoading:${String(isDetailsLoading)}`}</span>
    </div>
  ),
}));

const makeItem = (
  id: string,
  name: string,
  overrides: Partial<CatalogItem> = {},
): CatalogItem => ({
  id,
  type: CatalogEntityType.Model,
  name,
  version: '1.0',
  description: 'desc',
  topics: ['Free'],
  folder: ['EPAM'],
  lastUsed: '',
  ...overrides,
});

describe('Catalog', () => {
  it('renders page title', () => {
    render(<Catalog items={[]} favorites={[]} />);
    expect(screen.getByText('Catalog')).toBeTruthy();
  });

  it('renders custom page title', () => {
    render(
      <Catalog
        items={[]}
        favorites={[]}
        titles={{ pageTitle: 'My Catalog' }}
      />,
    );
    expect(screen.getByText('My Catalog')).toBeTruthy();
  });

  it('renders Create button', () => {
    render(<Catalog items={[]} favorites={[]} />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
  });

  it('defaults to the grid view', () => {
    render(<Catalog items={[]} favorites={[]} />);
    expect(screen.queryByLabelText('catalog list')).toBeNull();
  });

  it('starts in the list view when initialViewMode is List', () => {
    render(
      <Catalog
        items={[]}
        favorites={[]}
        initialViewMode={CatalogViewMode.List}
      />,
    );
    expect(screen.getByLabelText('catalog list')).toBeTruthy();
  });

  it('calls onCreateClick when Create is clicked', async () => {
    const onCreateClick = vi.fn();
    render(<Catalog items={[]} favorites={[]} onCreateClick={onCreateClick} />);
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreateClick).toHaveBeenCalledOnce();
  });

  it('renders CatalogFavorites when favorites are provided', () => {
    const fav = {
      id: 'f1',
      type: CatalogEntityType.Model,
      name: 'Claude',
      version: '1',
      lastUsed: 'now',
      description: '',
      folder: [],
      topics: [],
    };
    render(<Catalog items={[]} favorites={[fav]} />);
    expect(screen.getByText('Your favorites')).toBeTruthy();
  });

  it('does not render CatalogFavorites when favorites is empty', () => {
    render(<Catalog items={[]} favorites={[]} />);
    expect(screen.queryByText('Your favorites')).toBeNull();
  });

  it('applies horizontal and vertical padding to the empty state in the default grid view', () => {
    render(<Catalog items={[]} favorites={[]} />);
    const grid = screen.getByRole('grid', { name: 'catalog grid' });
    const wrapper = grid.parentElement?.parentElement;
    expect(wrapper?.className).toContain('px-8');
    expect(wrapper?.className).toContain('py-6');
  });

  it('renders items in the card grid', () => {
    render(<Catalog items={[makeItem('1', 'Claude')]} favorites={[]} />);
    expect(
      screen.getByRole('grid', { name: 'catalog grid' }).textContent,
    ).toContain('1 items');
  });

  it('applies topic filters to rendered items', async () => {
    render(
      <Catalog
        items={[
          makeItem('1', 'Claude', { topics: ['Free'] }),
          makeItem('2', 'Gemini', { topics: ['Paid'] }),
        ]}
        favorites={[]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Free' }));

    expect(
      screen.getByRole('grid', { name: 'catalog grid' }).textContent,
    ).toContain('1 items');
  });

  it('applies the My Apps filter to rendered items', async () => {
    render(
      <Catalog
        items={[
          makeItem('1', 'Claude', { isMyApp: true }),
          makeItem('2', 'Gemini', { isMyApp: false }),
        ]}
        favorites={[]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'My Apps' }));

    expect(
      screen.getByRole('grid', { name: 'catalog grid' }).textContent,
    ).toContain('1 items');
  });

  it('passes primary action visibility predicate to the details panel', async () => {
    render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        isPrimaryActionVisible={(item) => item.id === '1'}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));

    expect(screen.getByText('true')).toBeTruthy();
  });

  it('passes shareOverlay through to the details panel', async () => {
    const shareOverlay = vi.fn(() => <span>share overlay content</span>);
    render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        shareOverlay={shareOverlay}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));

    expect(shareOverlay).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', name: 'Claude' }),
      expect.any(Function),
    );
    expect(screen.getByText('share overlay content')).toBeTruthy();
  });

  it('calls onFetchDetails when the details panel opens', async () => {
    const onFetchDetails = vi.fn().mockResolvedValue(undefined);
    render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        onFetchDetails={onFetchDetails}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));

    expect(onFetchDetails).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
    );
  });

  it('forwards onDownload and isDownloadVisible to the details panel', async () => {
    const onDownload = vi.fn();
    render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        onDownload={onDownload}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'DownloadTrigger' }),
    );

    expect(onDownload).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
    );
  });

  it('lets isRevokeShareVisible hide the revoke action in the details panel', async () => {
    render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        onRevokeShare={vi.fn()}
        isRevokeShareVisible={() => false}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));

    expect(
      screen.queryByRole('button', { name: 'RevokeShareTrigger' }),
    ).toBeNull();
  });

  it('lets isDownloadVisible hide the download action in the details panel', async () => {
    render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        onDownload={vi.fn()}
        isDownloadVisible={() => false}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));

    expect(
      screen.queryByRole('button', { name: 'DownloadTrigger' }),
    ).toBeNull();
  });

  it('renders fetched details, overriding static item.details, once resolved', async () => {
    const fetched = { overview: { sections: [] } };
    let resolveFetch: (value: typeof fetched) => void = () => undefined;
    const onFetchDetails = vi.fn(
      () =>
        new Promise<typeof fetched>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    render(
      <Catalog
        items={[
          makeItem('1', 'Claude', {
            details: { pricing: { prices: [] } },
          }),
        ]}
        favorites={[]}
        onFetchDetails={onFetchDetails}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));
    expect(screen.getByText('isDetailsLoading:true')).toBeTruthy();

    resolveFetch(fetched);
    await screen.findByText(`details:${JSON.stringify(fetched)}`);
    expect(screen.getByText('isDetailsLoading:false')).toBeTruthy();
  });

  it('falls back to static item.details when onFetchDetails resolves undefined', async () => {
    const staticDetails = { pricing: { prices: [] } };
    const onFetchDetails = vi.fn().mockResolvedValue(undefined);

    render(
      <Catalog
        items={[makeItem('1', 'Claude', { details: staticDetails })]}
        favorites={[]}
        onFetchDetails={onFetchDetails}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));

    expect(
      await screen.findByText(`details:${JSON.stringify(staticDetails)}`),
    ).toBeTruthy();
  });

  it('does not fetch details or show a loading state when onFetchDetails is absent', async () => {
    render(<Catalog items={[makeItem('1', 'Claude')]} favorites={[]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));

    expect(screen.getByText('isDetailsLoading:false')).toBeTruthy();
    expect(screen.getByText('details:null')).toBeTruthy();
  });

  it('opens the details panel automatically for initialDetailsItemId', () => {
    render(
      <Catalog
        items={[makeItem('1', 'Claude'), makeItem('2', 'Gemini')]}
        favorites={[]}
        initialDetailsItemId="2"
      />,
    );

    expect(screen.getByText('Gemini', { selector: 'span' })).toBeTruthy();
  });

  it('does nothing when initialDetailsItemId matches no item', () => {
    render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        initialDetailsItemId="missing"
      />,
    );

    expect(screen.queryByText('Claude', { selector: 'span' })).toBeNull();
  });

  it('reopens the details panel when initialDetailsItemId reappears after being cleared', async () => {
    const onFetchDetails = vi.fn().mockResolvedValue(undefined);
    const items = [makeItem('1', 'Claude')];
    const { rerender } = render(
      <Catalog
        items={items}
        favorites={[]}
        onFetchDetails={onFetchDetails}
        initialDetailsItemId="1"
      />,
    );

    await waitFor(() => expect(onFetchDetails).toHaveBeenCalledOnce());

    rerender(
      <Catalog
        items={items}
        favorites={[]}
        onFetchDetails={onFetchDetails}
        initialDetailsItemId={undefined}
      />,
    );
    rerender(
      <Catalog
        items={items}
        favorites={[]}
        onFetchDetails={onFetchDetails}
        initialDetailsItemId="1"
      />,
    );

    await waitFor(() => expect(onFetchDetails).toHaveBeenCalledTimes(2));
  });

  it('does not reopen the details panel for the same initialDetailsItemId across an items identity change', async () => {
    const onFetchDetails = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        onFetchDetails={onFetchDetails}
        initialDetailsItemId="1"
      />,
    );

    await waitFor(() => expect(onFetchDetails).toHaveBeenCalledOnce());

    rerender(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        onFetchDetails={onFetchDetails}
        initialDetailsItemId="1"
      />,
    );

    await waitFor(() => expect(onFetchDetails).toHaveBeenCalledOnce());
  });

  it('defaults to recently-updated sort and empty filters when uncontrolled', () => {
    render(<Catalog items={[]} favorites={[]} />);
    expect(screen.getByText('sortKey:recently-updated')).toBeTruthy();
  });

  it('uses the controlled sortKey prop instead of internal default', () => {
    render(
      <Catalog items={[]} favorites={[]} sortKey={CatalogSortKey.Newest} />,
    );
    expect(screen.getByText('sortKey:newest')).toBeTruthy();
  });

  it('calls onSortChange when the sort option changes', async () => {
    const onSortChange = vi.fn();
    render(<Catalog items={[]} favorites={[]} onSortChange={onSortChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sort Newest' }));

    expect(onSortChange).toHaveBeenCalledWith(CatalogSortKey.Newest);
  });

  it('uses the controlled filterTopics prop instead of internal state', () => {
    render(
      <Catalog
        items={[
          makeItem('1', 'Claude', { topics: ['Free'] }),
          makeItem('2', 'Gemini', { topics: ['Paid'] }),
        ]}
        favorites={[]}
        filterTopics={new Set(['Paid'])}
      />,
    );

    expect(
      screen.getByRole('grid', { name: 'catalog grid' }).textContent,
    ).toContain('1 items');
  });

  it('calls onFilterTopicsChange when a topic filter is applied', async () => {
    const onFilterTopicsChange = vi.fn();
    render(
      <Catalog
        items={[makeItem('1', 'Claude', { topics: ['Free'] })]}
        favorites={[]}
        onFilterTopicsChange={onFilterTopicsChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Free' }));

    expect(onFilterTopicsChange).toHaveBeenCalledWith(new Set(['Free']));
  });

  it('uses the controlled isMyAppsActive prop instead of internal state', () => {
    render(
      <Catalog
        items={[
          makeItem('1', 'Claude', { isMyApp: true }),
          makeItem('2', 'Gemini', { isMyApp: false }),
        ]}
        favorites={[]}
        isMyAppsActive
      />,
    );

    expect(
      screen.getByRole('grid', { name: 'catalog grid' }).textContent,
    ).toContain('1 items');
  });

  it('calls onMyAppsActiveChange when the My Apps filter is toggled', async () => {
    const onMyAppsActiveChange = vi.fn();
    render(
      <Catalog
        items={[]}
        favorites={[]}
        onMyAppsActiveChange={onMyAppsActiveChange}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'My Apps' }));

    expect(onMyAppsActiveChange).toHaveBeenCalledWith(true);
  });
});

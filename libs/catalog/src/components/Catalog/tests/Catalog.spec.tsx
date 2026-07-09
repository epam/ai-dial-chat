import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogEntityType } from '../../../types/entity-type';
import { Catalog } from '../Catalog';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialSpinner: () => <div role="status" aria-label="Loading" />,
  DialEllipsisTooltip: ({
    text,
    className,
  }: {
    text: unknown;
    className?: string;
  }) => <span className={className}>{text as string}</span>,
  PrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  DialTabs: ({
    tabs,
    activeTab,
    onClick,
  }: {
    tabs: { id: string; label: React.ReactNode }[];
    activeTab: string;
    onClick: (id: string) => void;
  }) => (
    <div role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === activeTab}
          onClick={() => onClick(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
  DialDropdown: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  DialCloseButton: ({ onClick }: { onClick: () => void }) => (
    <button aria-label="Close" onClick={onClick} />
  ),
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
  }) => (
    <div>
      <span>{title ?? 'Browse'}</span>
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
  }: {
    item: CatalogItem;
    isPrimaryActionVisible?: (item: CatalogItem) => boolean;
  }) => (
    <div>
      <span>{item.name}</span>
      <span>{String(isPrimaryActionVisible?.(item))}</span>
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

  it('hides the Create button when hideCreateButton is true', () => {
    render(<Catalog items={[]} favorites={[]} hideCreateButton />);
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
  });

  it('shows the Create button by default', () => {
    render(<Catalog items={[]} favorites={[]} />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
  });

  it('hides the page title when hidePageTitle is true', () => {
    render(<Catalog items={[]} favorites={[]} hidePageTitle />);
    expect(screen.queryByText('Catalog')).toBeNull();
  });

  it('shows the page title by default', () => {
    render(<Catalog items={[]} favorites={[]} />);
    expect(screen.getByText('Catalog')).toBeTruthy();
  });

  it('renders neither heading row when both title and Create button are hidden', () => {
    render(
      <Catalog items={[]} favorites={[]} hidePageTitle hideCreateButton />,
    );
    expect(screen.queryByText('Catalog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
  });

  it('passes selectedItemId through to the card grid', () => {
    render(
      <Catalog
        items={[makeItem('1', 'Claude'), makeItem('2', 'Gemini')]}
        favorites={[]}
        selectedItemId="2"
      />,
    );

    expect(
      screen
        .getByRole('button', { name: 'Claude' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      screen
        .getByRole('button', { name: 'Gemini' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('calls onCardClick instead of opening details when provided', async () => {
    const onCardClick = vi.fn();
    render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        onCardClick={onCardClick}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));

    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', name: 'Claude' }),
    );
    expect(screen.queryByText('true')).toBeNull();
    expect(screen.queryByText('false')).toBeNull();
  });

  it('opens details on card click when onCardClick is not provided', async () => {
    render(<Catalog items={[makeItem('1', 'Claude')]} favorites={[]} />);

    await userEvent.click(screen.getByRole('button', { name: 'Claude' }));

    expect(screen.getAllByText('Claude').length).toBeGreaterThan(1);
  });

  it('passes selectedItemId through to the favorites section', () => {
    const fav1 = makeItem('1', 'Claude');
    const fav2 = makeItem('2', 'Gemini');
    render(<Catalog items={[]} favorites={[fav1, fav2]} selectedItemId="2" />);

    expect(
      screen
        .getByRole('button', { name: 'fav-Claude' })
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      screen
        .getByRole('button', { name: 'fav-Gemini' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('calls onCardClick instead of opening details when a favorite card is clicked', async () => {
    const onCardClick = vi.fn();
    render(
      <Catalog
        items={[]}
        favorites={[makeItem('1', 'Claude')]}
        onCardClick={onCardClick}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'fav-Claude' }));

    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', name: 'Claude' }),
    );
    expect(screen.queryByText('true')).toBeNull();
    expect(screen.queryByText('false')).toBeNull();
  });

  it('calls onCardClick instead of opening details when a list-view row is clicked', async () => {
    const onCardClick = vi.fn();
    render(
      <Catalog
        items={[makeItem('1', 'Claude')]}
        favorites={[]}
        onCardClick={onCardClick}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'List view' }));
    await userEvent.click(screen.getByRole('button', { name: 'row-Claude' }));

    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1', name: 'Claude' }),
    );
    expect(screen.queryByText('true')).toBeNull();
    expect(screen.queryByText('false')).toBeNull();
  });

  it('opens details on list-view row click when onCardClick is not provided', async () => {
    render(<Catalog items={[makeItem('1', 'Claude')]} favorites={[]} />);

    await userEvent.click(screen.getByRole('button', { name: 'List view' }));
    await userEvent.click(screen.getByRole('button', { name: 'row-Claude' }));

    expect(screen.getByText('Claude')).toBeTruthy();
  });
});

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
  DialPrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  DialGhostButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
  DialButton: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
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
  }: {
    title?: string;
    query: string;
    onQueryChange: (q: string) => void;
    filters?: Set<string>;
    onFiltersChange?: (filters: Set<string>) => void;
    filterValues?: Set<string>;
    isMyAppsActive?: boolean;
    onMyAppsChange?: (isActive: boolean) => void;
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
    </div>
  ),
}));
vi.mock('../../CardGrid/CardGrid', () => ({
  CardGrid: ({
    items,
    onItemClick,
  }: {
    items: CatalogItem[];
    onItemClick: (item: CatalogItem) => void;
  }) => (
    <div role="grid" aria-label="catalog grid">
      {items.length} items
      {items.map((item) => (
        <button key={item.id} onClick={() => onItemClick(item)}>
          {item.name}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('../../Favorites/Favorites', () => ({
  Favorites: ({ title }: { title?: string }) => (
    <div>{title ?? 'Your Favorites'}</div>
  ),
}));
vi.mock('../../ListView/ListView', () => ({
  ListView: () => <div role="grid" aria-label="catalog list" />,
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
});

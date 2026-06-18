import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CatalogEntityType } from '../../../types/entity-type';
import { Catalog } from '../Catalog';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
  DialSpinner: () => <div role="status" aria-label="Loading" />,
  DialPrimaryButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
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
  }: {
    title?: string;
    query: string;
    onQueryChange: (q: string) => void;
  }) => (
    <div>
      <span>{title ?? 'Browse'}</span>
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="search"
      />
    </div>
  ),
}));
vi.mock('../../CatalogCardGrid/CatalogCardGrid', () => ({
  CatalogCardGrid: ({ items }: { items: { id: string }[] }) => (
    <div role="grid" aria-label="catalog grid">
      {items.length} items
    </div>
  ),
}));
vi.mock('../../CatalogFavorites/CatalogFavorites', () => ({
  CatalogFavorites: ({ title }: { title?: string }) => (
    <div>{title ?? 'Your Favorites'}</div>
  ),
}));
vi.mock('../../CatalogListView/CatalogListView', () => ({
  CatalogListView: () => <div role="grid" aria-label="catalog list" />,
}));

const makeItem = (id: string, name: string) => ({
  id,
  type: CatalogEntityType.Model,
  name,
  version: '1.0',
  description: 'desc',
  pricing: ['Free'],
  folder: ['EPAM'],
  lastUsed: '',
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
    };
    render(<Catalog items={[]} favorites={[fav]} />);
    expect(screen.getByText('Your Favorites')).toBeTruthy();
  });

  it('does not render CatalogFavorites when favorites is empty', () => {
    render(<Catalog items={[]} favorites={[]} />);
    expect(screen.queryByText('Your Favorites')).toBeNull();
  });

  it('renders items in the card grid', () => {
    render(<Catalog items={[makeItem('1', 'Claude')]} favorites={[]} />);
    expect(
      screen.getByRole('grid', { name: 'catalog grid' }).textContent,
    ).toContain('1 items');
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CatalogEntityType } from '../../../types/CatalogEntityType';
import { Catalog } from '../Catalog';
vi.mock('@epam/ai-dial-ui-kit', () => ({
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
vi.mock('../../CatalogBrowseToolbar/CatalogBrowseToolbar', () => ({
  CatalogBrowseToolbar: ({
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
    <div data-testid="card-grid">{items.length} items</div>
  ),
}));
vi.mock('../../CatalogFavorites/CatalogFavorites', () => ({
  CatalogFavorites: ({ title }: { title?: string }) => (
    <div>{title ?? 'Your Favorites'}</div>
  ),
}));
vi.mock('../../CatalogListView/CatalogListView', () => ({
  CatalogListView: () => <div data-testid="list-view" />,
}));

const makeItem = (id: string, name: string) => ({
  id,
  type: CatalogEntityType.Model,
  name,
  version: '1.0',
  description: 'desc',
  pricing: ['Free'],
  folder: ['EPAM'],
  logoColor: '#000',
  logoInitial: 'X',
  lastUsed: '',
  from: 'dial',
  domain: 'Engineering',
  useCase: 'Code generation',
  maturity: 'Production',
});

describe('Catalog', () => {
  it('renders page title', () => {
    render(<Catalog items={[]} favorites={[]} />);
    expect(screen.getByText('Catalog')).toBeTruthy();
  });

  it('renders custom page title', () => {
    render(<Catalog items={[]} favorites={[]} pageTitle="My Catalog" />);
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
      logoColor: '#000',
      logoInitial: 'C',
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
    expect(screen.getByTestId('card-grid').textContent).toContain('1 items');
  });
});

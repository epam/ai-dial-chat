import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogEntityType } from '../../../types/CatalogEntityType';
import { CatalogCardGrid } from '../CatalogCardGrid';
vi.mock('../../CatalogCard/CatalogCard', () => ({
  CatalogCard: ({ item }: { item: { name: string } }) => <div>{item.name}</div>,
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

describe('CatalogCardGrid', () => {
  it('renders cards when items are present', () => {
    render(
      <CatalogCardGrid
        items={[makeItem('1', 'Claude'), makeItem('2', 'GPT')]}
      />,
    );
    expect(screen.getByText('Claude')).toBeTruthy();
    expect(screen.getByText('GPT')).toBeTruthy();
  });

  it('shows empty state when no items', () => {
    render(
      <CatalogCardGrid
        items={[]}
        noResultsTitle='No results for "foo"'
        noResultsDescription="Try a different keyword"
      />,
    );
    expect(screen.getByText('No results for "foo"')).toBeTruthy();
    expect(screen.getByText('Try a different keyword')).toBeTruthy();
  });

  it('shows default empty state text', () => {
    render(<CatalogCardGrid items={[]} />);
    expect(screen.getByText('No results')).toBeTruthy();
  });
});

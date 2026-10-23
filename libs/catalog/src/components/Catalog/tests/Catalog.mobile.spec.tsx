import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import type { CatalogProps } from '../../../models/catalog-props';
import type { FavoritesProps } from '../../../models/favorites';
import { Catalog } from '../Catalog';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...actual, useIsMobile: () => true };
});

// The sections around the Create button are covered by their own suites.
vi.mock('../../Toolbar/Toolbar', () => ({ Toolbar: () => null }));
vi.mock('../../CardGrid/CardGrid', () => ({ CardGrid: () => null }));
vi.mock('../../ListView/ListView', () => ({ ListView: () => null }));
vi.mock('../../Details/DetailsPanel', () => ({ DetailsPanel: () => null }));
vi.mock('../../Favorites/Favorites', () => ({
  Favorites: ({ isPaginationHidden }: FavoritesProps) => (
    <div
      role="region"
      aria-label="favorites"
      data-pagination-hidden={String(Boolean(isPaginationHidden))}
    />
  ),
}));

const favorite: CatalogItem = {
  id: 'fav-1',
  type: CatalogEntityType.Agent,
  name: 'Fav 1',
  version: '1.0',
  description: '',
  topics: [],
  folder: [],
  lastUsed: '',
};

describe('Catalog — mobile', () => {
  const renderCatalog = (props?: Partial<CatalogProps>) =>
    render(
      <Catalog
        items={[]}
        favorites={[]}
        titles={{ pageTitle: 'My Catalog' }}
        {...props}
      />,
    );

  it('moves Create from the page header to a round floating button', () => {
    renderCatalog();

    const create = screen.getByRole('button', { name: 'Create' });
    expect(create.textContent).toBe('');
    expect(create.className).toContain('rounded-full');
    expect(create.parentElement?.className).toContain('bottom-4');
    expect(
      screen.getByRole('heading', { name: 'My Catalog' }).parentElement
        ?.textContent,
    ).toBe('My Catalog');
  });

  it('pads the scrolling content so the floating button clears the last row', () => {
    renderCatalog();

    const create = screen.getByRole('button', { name: 'Create' });
    // eslint-disable-next-line testing-library/no-node-access
    const scrollBody = create.parentElement?.nextElementSibling;
    expect(scrollBody?.className).toContain('pb-16');
  });

  it('renders no Create button when the catalog is read-only', () => {
    renderCatalog({ isReadonly: true });

    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
  });

  it('forwards isFavoritesPaginationHidden to the favorites strip', () => {
    renderCatalog({
      favorites: [favorite],
      isFavoritesPaginationHidden: true,
    });

    expect(
      screen
        .getByRole('region', { name: 'favorites' })
        .getAttribute('data-pagination-hidden'),
    ).toBe('true');
  });
});

import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('renders no floating Create button and no padding for it when creation controls are hidden', () => {
    renderCatalog({
      hideCreateButton: true,
      createOptions: [{ key: 'prompt', label: 'Prompt', onClick: vi.fn() }],
    });

    expect(screen.queryByRole('button', { name: 'Create' })).toBeNull();
    // eslint-disable-next-line testing-library/no-node-access -- the padding class has no accessible counterpart
    expect(document.querySelector('.pb-16')).toBeNull();
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

describe('Catalog — mobile scroll to top', () => {
  /* jsdom has no layout: give the scroll body one screen of height, then
     scroll it by that much so the button is offered. */
  const scrollDownOneScreen = (scrollBody: Element) => {
    Object.defineProperty(scrollBody, 'clientHeight', {
      configurable: true,
      value: 600,
    });
    scrollBody.scrollTop = 600;
    fireEvent.scroll(scrollBody);
  };

  /*
   * The button's positioned wrapper (outside the kit's tooltip wrapper)
   * carries the placement, and has no role or text of its own; the scroll body is reached the same way as in the padding test.
   */
  const getPlacement = (button: HTMLElement) =>
    // eslint-disable-next-line testing-library/no-node-access
    button.closest('.absolute')?.className ?? '';

  it('stacks the button above the floating Create button', async () => {
    render(<Catalog items={[]} favorites={[]} />);
    const create = screen.getByRole('button', { name: 'Create' });
    // eslint-disable-next-line testing-library/no-node-access
    scrollDownOneScreen(create.parentElement?.nextElementSibling as Element);

    const scrollToTop = await screen.findByRole('button', {
      name: 'Scroll to top',
    });

    expect(getPlacement(scrollToTop)).toContain('bottom-20');
    expect(getPlacement(scrollToTop)).toContain('inset-e-4');
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy();
  });

  it('takes the Create button spot when there is no Create button', async () => {
    const { container } = render(
      <Catalog items={[]} favorites={[]} isReadonly />,
    );
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    scrollDownOneScreen(container.querySelector('.overflow-y-auto') as Element);

    const scrollToTop = await screen.findByRole('button', {
      name: 'Scroll to top',
    });

    expect(getPlacement(scrollToTop)).toContain('bottom-4');
  });

  it('keeps the up arrow unmirrored in right-to-left layouts', async () => {
    document.documentElement.dir = 'rtl';
    render(<Catalog items={[]} favorites={[]} />);
    const create = screen.getByRole('button', { name: 'Create' });
    // eslint-disable-next-line testing-library/no-node-access
    scrollDownOneScreen(create.parentElement?.nextElementSibling as Element);

    const scrollToTop = await screen.findByRole('button', {
      name: 'Scroll to top',
    });

    // eslint-disable-next-line testing-library/no-node-access
    const icon = scrollToTop.querySelector('svg');
    expect(icon?.getAttribute('class') ?? '').not.toContain('rtl:scale-x');
    document.documentElement.dir = '';
  });
});

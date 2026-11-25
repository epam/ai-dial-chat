import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CARD_HEIGHT, CARD_ROW_GAP } from '../../../constants/virtual-grid';
import type { CatalogCardRenderProps } from '../../../models/card-props';
import type { CatalogItem } from '../../../models/catalog-item';
import { CardGrid } from '../CardGrid';

vi.mock('../Card', () => ({
  Card: ({ item }: { item: CatalogItem }) => <div>builtin-{item.name}</div>,
}));

const buildItem = (id: string): CatalogItem => ({
  id,
  type: CatalogEntityType.Model,
  name: id,
  version: '1',
  description: '',
  lastUsed: '',
  folder: [],
  topics: [],
});

const items = [buildItem('alpha'), buildItem('beta')];

describe('CardGrid', () => {
  it('renders the built-in card for every item when renderCard is not passed', () => {
    render(<CardGrid items={items} />);

    expect(screen.getByText('builtin-alpha')).toBeTruthy();
    expect(screen.getByText('builtin-beta')).toBeTruthy();
  });

  describe('renderCard', () => {
    it('renders its result in place of the built-in card for every item', () => {
      render(
        <CardGrid
          items={items}
          renderCard={({ item }) => <div>host-{item.name}</div>}
        />,
      );

      expect(screen.getByText('host-alpha')).toBeTruthy();
      expect(screen.getByText('host-beta')).toBeTruthy();
      expect(screen.queryByText('builtin-alpha')).toBeNull();
    });

    it('hands each card its item, the query, selection, read-only flag and active tab', () => {
      const renderCard = vi.fn(({ item }: CatalogCardRenderProps) => (
        <div>host-{item.name}</div>
      ));
      render(
        <CardGrid
          items={items}
          onItemClick={vi.fn()}
          query="al"
          selectedItemId="beta"
          isReadonly
          activeTab={CatalogEntityType.Model}
          renderCard={renderCard}
        />,
      );

      expect(renderCard).toHaveBeenCalledWith({
        item: items[0],
        query: 'al',
        isSelected: false,
        isReadonly: true,
        activeTab: CatalogEntityType.Model,
        onClick: expect.any(Function),
      });
      expect(renderCard).toHaveBeenCalledWith(
        expect.objectContaining({ item: items[1], isSelected: true }),
      );
    });

    it('opens the item through onItemClick when the card calls onClick', async () => {
      const onItemClick = vi.fn();
      render(
        <CardGrid
          items={items}
          onItemClick={onItemClick}
          renderCard={({ item, onClick }) => (
            <button onClick={onClick}>open-{item.name}</button>
          )}
        />,
      );

      await userEvent.click(screen.getByRole('button', { name: 'open-beta' }));

      expect(onItemClick).toHaveBeenCalledWith(items[1]);
    });

    it('gives the card no onClick when the grid has no click handler', () => {
      const renderCard = vi.fn(({ item }: CatalogCardRenderProps) => (
        <div>host-{item.name}</div>
      ));
      render(<CardGrid items={items} renderCard={renderCard} />);

      expect(renderCard.mock.calls[0][0].onClick).toBeUndefined();
    });
  });

  describe('cardHeight', () => {
    /* The row's inline height is the only trace of the allotted size, so this
     * asserts a style attribute rather than a semantic query. */
    const getRowHeight = (name: string): string | undefined =>
      // eslint-disable-next-line testing-library/no-node-access
      screen.getByText(name).closest<HTMLElement>('div.absolute')?.style.height;

    it('allots the default card height plus the row gap to each row', () => {
      render(<CardGrid items={items} />);

      expect(getRowHeight('builtin-alpha')).toBe(
        `${CARD_HEIGHT + CARD_ROW_GAP}px`,
      );
    });

    it('allots a given card height plus the row gap to each row', () => {
      render(<CardGrid items={items} cardHeight={180} />);

      expect(getRowHeight('builtin-alpha')).toBe(`${180 + CARD_ROW_GAP}px`);
    });
  });
});

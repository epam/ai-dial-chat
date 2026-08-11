import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { DetailsConfirmationVariant } from '../../../types/details-confirmation';
import { CatalogEntityType } from '../../../types/entity-type';
import { InfoCard } from '../InfoCard';

vi.mock('../../EntityHeader/EntityHeader', () => ({
  EntityHeader: ({
    item,
    iconSize,
  }: {
    item: CatalogItem;
    iconSize: number;
  }) => (
    <div>
      {item.name}:{iconSize}
    </div>
  ),
}));

const item: CatalogItem = {
  id: '1',
  type: CatalogEntityType.Toolset,
  name: 'Search',
  version: '1.0',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
};

const renderCard = (props?: Partial<Parameters<typeof InfoCard>[0]>) =>
  render(<InfoCard item={item} {...props} />);

describe('InfoCard', () => {
  it('renders the item identity', () => {
    renderCard();
    expect(screen.getByText('Search:40')).toBeTruthy();
  });

  it('uses the info surface by default', () => {
    const { container } = renderCard();
    expect(container.firstElementChild?.className).toContain('info');
  });

  it('uses the danger surface for the danger variant', () => {
    const { container } = renderCard({
      variant: DetailsConfirmationVariant.Danger,
    });
    expect(container.firstElementChild?.className).toContain('danger');
  });

  it('forwards a custom icon size', () => {
    renderCard({ iconSize: 52 });
    expect(screen.getByText('Search:52')).toBeTruthy();
  });
});

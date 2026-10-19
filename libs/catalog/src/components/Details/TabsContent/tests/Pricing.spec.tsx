import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CatalogItemPricing } from '../../../../models/item-details-data';
import { CatalogPricingUnit } from '../../../../types/pricing-unit';
import { Pricing } from '../Pricing';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
}));

const prices: CatalogItemPricing['prices'] = [
  { label: 'Input', price: '$0.15/M chars without whitespace' },
];

describe('Pricing', () => {
  it('renders the token heading when the unit is absent', () => {
    render(<Pricing pricing={{ prices }} />);

    expect(screen.getByText('Token pricing')).toBeTruthy();
    expect(screen.queryByText('Character pricing')).toBeNull();
  });

  it('renders the character heading when prices are quoted per character', () => {
    render(
      <Pricing
        pricing={{ prices, unit: CatalogPricingUnit.Character }}
        characterPricesSectionLabel="Prix par caractère"
      />,
    );

    expect(screen.getByText('Prix par caractère')).toBeTruthy();
    expect(screen.queryByText('Token pricing')).toBeNull();
  });
});

import { ConfirmationPopupVariant } from '@epam/ai-dial-ui-kit';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EntityHeaderItem } from '../../../models/entity';
import { CatalogEntityType } from '../../../types/entity-type';
import { ConfirmationIdentityCard } from '../ConfirmationIdentityCard';

const item: EntityHeaderItem = {
  type: CatalogEntityType.Toolset,
  name: 'Search',
  version: '1.0',
};

const renderCard = (
  props?: Partial<Parameters<typeof ConfirmationIdentityCard>[0]>,
) => render(<ConfirmationIdentityCard item={item} {...props} />);

describe('ConfirmationIdentityCard', () => {
  it('renders the entity identity without its version tag', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Search' })).toBeTruthy();
    expect(screen.getByText(CatalogEntityType.Toolset)).toBeTruthy();
    expect(screen.queryByText(/current/)).toBeNull();
  });

  it('renders children in place of the entity identity', () => {
    renderCard({ children: <span>Weekly report</span> });

    expect(screen.getByText('Weekly report')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Search' })).toBeNull();
  });
});

/*
 * The surface is the whole point of this component, and it is expressed as a
 * class and inline custom properties on the rendered root — neither of which
 * Testing Library's queries can reach, since "this card is tinted red" has no
 * accessible name.
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
describe('ConfirmationIdentityCard surface', () => {
  it('uses the info surface by default', () => {
    const { container } = renderCard();

    expect(container.firstElementChild?.className).toContain('info');
  });

  it('uses the danger surface for the danger variant', () => {
    const { container } = renderCard({
      variant: ConfirmationPopupVariant.Danger,
    });

    expect(container.firstElementChild?.className).toContain('danger');
  });

  it('applies the info surface override', () => {
    const { container } = renderCard({
      styles: { colors: { background: 'rgb(1, 2, 3)' } },
    });
    const card = container.firstElementChild as HTMLElement;

    expect(card.style.getPropertyValue('--rs-bg')).toBe('rgb(1, 2, 3)');
  });

  it('applies the danger surface and border overrides', () => {
    const { container } = renderCard({
      variant: ConfirmationPopupVariant.Danger,
      styles: {
        colors: {
          dangerBackground: 'rgb(4, 5, 6)',
          dangerBorder: 'rgb(7, 8, 9)',
        },
      },
    });
    const card = container.firstElementChild as HTMLElement;

    expect(card.style.getPropertyValue('--rs-bg')).toBe('rgb(4, 5, 6)');
    expect(card.style.getPropertyValue('--rs-border')).toBe('rgb(7, 8, 9)');
  });

  it('ignores the override belonging to the other variant', () => {
    const { container } = renderCard({
      styles: { colors: { dangerBackground: 'rgb(4, 5, 6)' } },
    });
    const card = container.firstElementChild as HTMLElement;

    expect(card.style.getPropertyValue('--rs-bg')).toBe('');
  });

  it('forwards a custom icon size to the identity icon', () => {
    const { container } = renderCard({ iconSize: 52 });
    const iconBadge = container.querySelector(
      '[aria-hidden="true"]',
    ) as HTMLElement;

    expect(iconBadge.style.width).toBe('52px');
  });
});

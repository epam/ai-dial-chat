import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogEntityType } from '../../../types/entity-type';
import { FavoriteCard } from '../FavoriteCard';

const makeItem = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: '1',
  type: CatalogEntityType.Model,
  name: 'Claude',
  version: '1.0',
  description: 'desc',
  topics: [],
  folder: [],
  lastUsed: '',
  ...overrides,
});

describe('FavoriteCard — selected state', () => {
  it('does not show a selected border or checkmark by default', () => {
    render(<FavoriteCard item={makeItem()} />);

    const card = screen.getByLabelText('Claude');
    expect(card.className).toContain('border-transparent');
    expect(card.className).not.toContain('border-accent-primary');
    expect(card.querySelector('svg[aria-hidden]')).toBeNull();
  });

  it('shows the selected border, tint, and checkmark when isSelected is true', () => {
    render(<FavoriteCard item={makeItem()} isSelected />);

    const card = screen.getByLabelText('Claude');
    expect(card.className).toContain('border-accent-primary');
    expect(card.className).toContain('bg-accent-primary-alpha');
    expect(card.querySelector('svg[aria-hidden]')).toBeTruthy();
  });
});

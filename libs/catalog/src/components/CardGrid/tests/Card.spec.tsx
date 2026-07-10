import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../../models/catalog-item';
import { CatalogEntityType } from '../../../types/entity-type';
import { Card } from '../Card';

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

describe('Card — selected state', () => {
  it('does not show a selected border or checkmark by default', () => {
    render(<Card item={makeItem()} />);

    const card = screen.getByRole('article', { hidden: true });
    expect(card.className).toContain('border-transparent');
    expect(card.className).not.toContain('border-accent-primary');
  });

  it('shows the selected border, tint, and checkmark when isSelected is true', () => {
    render(<Card item={makeItem()} isSelected />);

    const card = screen.getByRole('article', { hidden: true });
    expect(card.className).toContain('border-accent-primary');
    expect(card.className).toContain('bg-accent-primary-alpha');
    expect(card.querySelector('svg')).toBeTruthy();
  });
});

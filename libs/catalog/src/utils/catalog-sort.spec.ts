import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../models/catalog-item';
import { CatalogEntityType } from '../types/entity-type';
import { CatalogSortKey } from '../types/sort';
import { sortCatalogItems } from './catalog-sort';

const makeItem = (
  overrides: Partial<CatalogItem> & Pick<CatalogItem, 'id' | 'name'>,
): CatalogItem => ({
  type: CatalogEntityType.Model,
  version: '',
  lastUsed: '',
  description: '',
  topics: [],
  folder: [],
  isFeatured: false,
  ...overrides,
});

describe('sortCatalogItems', () => {
  it('sorts items alphabetically ascending (NameAZ)', () => {
    const items = [
      makeItem({ id: '1', name: 'Zebra' }),
      makeItem({ id: '2', name: 'Alpha' }),
      makeItem({ id: '3', name: 'Beta' }),
    ];
    const result = sortCatalogItems(items, CatalogSortKey.NameAZ);
    expect(result.map((i) => i.name)).toEqual(['Alpha', 'Beta', 'Zebra']);
  });

  it('puts featured items before non-featured in NameAZ', () => {
    const items = [
      makeItem({ id: '1', name: 'Zebra', isFeatured: false }),
      makeItem({ id: '2', name: 'Alpha', isFeatured: true }),
      makeItem({ id: '3', name: 'Beta', isFeatured: true }),
      makeItem({ id: '4', name: 'Mango', isFeatured: false }),
    ];
    const result = sortCatalogItems(items, CatalogSortKey.NameAZ);
    expect(result.map((i) => i.name)).toEqual([
      'Alpha',
      'Beta',
      'Mango',
      'Zebra',
    ]);
  });

  it('sorts by updatedAt descending (Newest)', () => {
    const items = [
      makeItem({ id: '1', name: 'A', updatedAt: 1000 }),
      makeItem({ id: '2', name: 'B', updatedAt: 3000 }),
      makeItem({ id: '3', name: 'C', updatedAt: 2000 }),
    ];
    const result = sortCatalogItems(items, CatalogSortKey.RecentlyUpdated);
    expect(result.map((i) => i.id)).toEqual(['2', '3', '1']);
  });

  it('sorts items without updatedAt last (Newest)', () => {
    const items = [
      makeItem({ id: '1', name: 'A', updatedAt: 1000 }),
      makeItem({ id: '2', name: 'B' }),
      makeItem({ id: '3', name: 'C', updatedAt: 2000 }),
    ];
    const result = sortCatalogItems(items, CatalogSortKey.RecentlyUpdated);
    expect(result[result.length - 1].id).toBe('2');
  });

  it('preserves original order for unknown sort key without throwing', () => {
    const items = [
      makeItem({ id: '3', name: 'C' }),
      makeItem({ id: '1', name: 'A' }),
    ];
    expect(() => sortCatalogItems(items, 'unknown-key')).not.toThrow();
    expect(sortCatalogItems(items, 'unknown-key').map((i) => i.id)).toEqual([
      '3',
      '1',
    ]);
  });
});

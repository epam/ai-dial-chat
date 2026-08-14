import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../models/catalog-item';
import { filterCatalogItems } from './catalog-filter';

const makeItem = (
  overrides: Partial<CatalogItem> & Pick<CatalogItem, 'id' | 'name'>,
): CatalogItem => ({
  type: CatalogEntityType.Model,
  version: '',
  lastUsed: '',
  description: '',
  topics: [],
  folder: [],
  ...overrides,
});

describe('filterCatalogItems', () => {
  it('returns all items when query is empty', () => {
    const items = [
      makeItem({ id: '1', name: 'GPT-4' }),
      makeItem({ id: '2', name: 'Claude' }),
    ];
    expect(filterCatalogItems(items, '')).toEqual(items);
  });

  it('matches items by name (case-insensitive)', () => {
    const items = [
      makeItem({ id: '1', name: 'gpt-4o' }),
      makeItem({ id: '2', name: 'Claude' }),
    ];
    const result = filterCatalogItems(items, 'GPT');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches items by description', () => {
    const items = [
      makeItem({
        id: '1',
        name: 'Model A',
        description: 'Supports Vision tasks',
      }),
      makeItem({ id: '2', name: 'Model B', description: 'Text only' }),
    ];
    const result = filterCatalogItems(items, 'vision');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('matches items by type', () => {
    const items = [
      makeItem({ id: '1', name: 'Alpha', type: CatalogEntityType.Agent }),
      makeItem({ id: '2', name: 'Beta', type: CatalogEntityType.Model }),
    ];
    const result = filterCatalogItems(items, 'agent');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('returns empty array when no items match', () => {
    const items = [
      makeItem({ id: '1', name: 'GPT-4' }),
      makeItem({ id: '2', name: 'Claude' }),
    ];
    expect(filterCatalogItems(items, 'xyzzy-no-match')).toHaveLength(0);
  });
});

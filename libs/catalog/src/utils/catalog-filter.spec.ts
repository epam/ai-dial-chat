import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../models/catalog-item';
import { filterCatalogItems, getTopicOptions } from './catalog-filter';

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

  it('does not match items by description', () => {
    const items = [
      makeItem({
        id: '1',
        name: 'Model A',
        description: 'Supports Vision tasks',
      }),
      makeItem({ id: '2', name: 'Model B', description: 'Text only' }),
    ];
    expect(filterCatalogItems(items, 'vision')).toHaveLength(0);
  });

  it('does not match items by type', () => {
    const items = [
      makeItem({ id: '1', name: 'Alpha', type: CatalogEntityType.Agent }),
      makeItem({ id: '2', name: 'Beta', type: CatalogEntityType.Toolset }),
    ];
    expect(filterCatalogItems(items, 'agent')).toHaveLength(0);
    expect(filterCatalogItems(items, 'toolset')).toHaveLength(0);
  });

  it('keeps only the toolsets whose name contains the query', () => {
    const items = [
      makeItem({
        id: '1',
        name: 'BigQuery',
        type: CatalogEntityType.Toolset,
        description: 'Warehouse access',
      }),
      makeItem({
        id: '2',
        name: 'Confluence',
        type: CatalogEntityType.Toolset,
        description: 'Run a query against pages',
      }),
    ];
    const result = filterCatalogItems(items, 'query');
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

describe('getTopicOptions', () => {
  it('returns the distinct set of topics across items', () => {
    const items = [
      makeItem({ id: '1', name: 'GPT-4', topics: ['Free', 'Text'] }),
      makeItem({ id: '2', name: 'Claude', topics: ['Paid', 'Text'] }),
    ];
    expect(getTopicOptions(items)).toEqual(new Set(['Free', 'Text', 'Paid']));
  });

  it('returns an empty set when no items have topics', () => {
    const items = [makeItem({ id: '1', name: 'GPT-4' })];
    expect(getTopicOptions(items)).toEqual(new Set());
  });
});

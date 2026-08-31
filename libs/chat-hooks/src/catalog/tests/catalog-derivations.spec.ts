import type { CatalogItem } from '@epam/ai-dial-catalog';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  deriveAvailableTabIds,
  deriveFavoriteItems,
  filterCatalogItemsBySelector,
  filterHiddenOwnedItems,
  reconcileFilterTopics,
} from '../catalog-derivations';

const makeItem = (
  id: string,
  type: CatalogEntityType,
  overrides: Partial<CatalogItem> = {},
): CatalogItem =>
  ({
    id,
    type,
    name: id,
    version: '',
    lastUsed: '',
    description: '',
    folder: [],
    topics: [],
    ...overrides,
  }) as CatalogItem;

describe('filterCatalogItemsBySelector', () => {
  it('returns only items whose type is in visibleTypes', () => {
    const model = makeItem('m', CatalogEntityType.Model);
    const prompt = makeItem('p', CatalogEntityType.Prompt);
    const visible = new Set([CatalogEntityType.Model]);
    expect(filterCatalogItemsBySelector([model, prompt], visible)).toEqual([
      model,
    ]);
  });

  it('returns an empty array when no items match', () => {
    const model = makeItem('m', CatalogEntityType.Model);
    const visible = new Set([CatalogEntityType.Prompt]);
    expect(filterCatalogItemsBySelector([model], visible)).toEqual([]);
  });

  it('returns all items when all types are in visibleTypes', () => {
    const model = makeItem('m', CatalogEntityType.Model);
    const prompt = makeItem('p', CatalogEntityType.Prompt);
    const visible = new Set([
      CatalogEntityType.Model,
      CatalogEntityType.Prompt,
    ]);
    expect(filterCatalogItemsBySelector([model, prompt], visible)).toHaveLength(
      2,
    );
  });
});

describe('filterHiddenOwnedItems', () => {
  it('filters out owned items when hideOwned is true', () => {
    const owned = makeItem('o', CatalogEntityType.Model, { isMyApp: true });
    const other = makeItem('x', CatalogEntityType.Model, { isMyApp: false });
    expect(filterHiddenOwnedItems([owned, other], true)).toEqual([other]);
  });

  it('returns a new array with the same items when hideOwned is false', () => {
    const items = [makeItem('o', CatalogEntityType.Model, { isMyApp: true })];
    const result = filterHiddenOwnedItems(items, false);
    expect(result).toEqual(items);
    expect(result).not.toBe(items);
  });

  it('keeps items without isMyApp when hideOwned is true', () => {
    const item = makeItem('x', CatalogEntityType.Model);
    expect(filterHiddenOwnedItems([item], true)).toEqual([item]);
  });
});

describe('deriveFavoriteItems', () => {
  it('returns only items marked as user favorites', () => {
    const fav = makeItem('f', CatalogEntityType.Model, {
      isUserFavorite: true,
    });
    const other = makeItem('x', CatalogEntityType.Model, {
      isUserFavorite: false,
    });
    expect(deriveFavoriteItems([fav, other])).toEqual([fav]);
  });

  it('retains original order of favorited items', () => {
    const a = makeItem('a', CatalogEntityType.Model, { isUserFavorite: true });
    const b = makeItem('b', CatalogEntityType.Agent, { isUserFavorite: false });
    const c = makeItem('c', CatalogEntityType.Prompt, { isUserFavorite: true });
    expect(deriveFavoriteItems([a, b, c])).toEqual([a, c]);
  });

  it('returns empty array when no items are favorited', () => {
    const item = makeItem('x', CatalogEntityType.Model);
    expect(deriveFavoriteItems([item])).toEqual([]);
  });
});

describe('deriveAvailableTabIds', () => {
  const TAB_ORDER = [
    CatalogEntityType.Model,
    CatalogEntityType.Agent,
    CatalogEntityType.Prompt,
  ] as const;

  it('returns only tab ids whose type is present in items', () => {
    const model = makeItem('m', CatalogEntityType.Model);
    const prompt = makeItem('p', CatalogEntityType.Prompt);
    expect(deriveAvailableTabIds([model, prompt], TAB_ORDER)).toEqual([
      CatalogEntityType.Model,
      CatalogEntityType.Prompt,
    ]);
  });

  it('preserves tab order even when items are in a different order', () => {
    const prompt = makeItem('p', CatalogEntityType.Prompt);
    const model = makeItem('m', CatalogEntityType.Model);
    expect(deriveAvailableTabIds([prompt, model], TAB_ORDER)).toEqual([
      CatalogEntityType.Model,
      CatalogEntityType.Prompt,
    ]);
  });

  it('returns empty array when no items match any tab', () => {
    const skill = makeItem('s', CatalogEntityType.Skill);
    expect(deriveAvailableTabIds([skill], TAB_ORDER)).toEqual([]);
  });
});

describe('reconcileFilterTopics', () => {
  it('returns only topics present in both persisted set and items', () => {
    const item = makeItem('x', CatalogEntityType.Model, {
      topics: ['alpha', 'gamma'],
    });
    const persisted = new Set(['alpha', 'beta']);
    const result = reconcileFilterTopics(persisted, [item]);
    expect(result).toEqual(new Set(['alpha']));
  });

  it('does not mutate either input', () => {
    const persisted = new Set(['alpha', 'beta']);
    const item = makeItem('x', CatalogEntityType.Model, { topics: ['alpha'] });
    const originalSize = persisted.size;
    reconcileFilterTopics(persisted, [item]);
    expect(persisted.size).toBe(originalSize);
  });

  it('returns a new Set instance', () => {
    const persisted = new Set(['alpha']);
    const item = makeItem('x', CatalogEntityType.Model, { topics: ['alpha'] });
    const result = reconcileFilterTopics(persisted, [item]);
    expect(result).not.toBe(persisted);
  });

  it('returns empty set when no persisted topic appears in items', () => {
    const persisted = new Set(['missing']);
    const item = makeItem('x', CatalogEntityType.Model, { topics: ['other'] });
    expect(reconcileFilterTopics(persisted, [item])).toEqual(new Set());
  });

  it('returns empty set when items array is empty', () => {
    const persisted = new Set(['alpha']);
    expect(reconcileFilterTopics(persisted, [])).toEqual(new Set());
  });
});

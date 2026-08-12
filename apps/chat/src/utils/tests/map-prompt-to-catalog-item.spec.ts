import { CatalogEntityType } from '@epam/ai-dial-catalog';
import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { CatalogI18nKeys } from '../../constants/translation-keys';
import { PromptSource } from '../../types/prompt';
import { mapPromptToCatalogItem } from '../map-prompt-to-catalog-item';

const LABELS: Record<string, string> = {
  [CatalogI18nKeys.FolderPersonal]: 'Personal',
  [CatalogI18nKeys.FolderShared]: 'Shared with me',
  [CatalogI18nKeys.FolderPublic]: 'Organization',
};

const t = ((key: string) => LABELS[key] ?? key) as unknown as TFunction;

const NO_FAVORITES: ReadonlySet<string> = new Set();

const makePrompt = (
  overrides: Partial<PromptResponseDto> = {},
): PromptResponseDto => ({
  id: 'Work/AI/summarize',
  name: 'summarize',
  description: 'Summarize a document',
  content: 'Summarize the following text:',
  folderId: 'Work/AI',
  createdAt: 1700000000000,
  updatedAt: 1700000001000,
  ...overrides,
});

describe('mapPromptToCatalogItem', () => {
  it('maps a personal prompt in a nested folder', () => {
    const item = mapPromptToCatalogItem(makePrompt(), {
      t,
      source: PromptSource.Personal,
      favoriteIds: NO_FAVORITES,
    });

    expect(item.id).toBe('Work/AI/summarize');
    expect(item.type).toBe(CatalogEntityType.Prompt);
    expect(item.name).toBe('summarize');
    expect(item.description).toBe('Summarize a document');
    expect(item.isMyApp).toBe(true);
    expect(item.isEditable).toBe(true);
    expect(item.sharedWithMe).toBe(false);
    expect(item.folder).toEqual(['Personal', 'Work', 'AI']);
    expect(item.details?.promptContent).toEqual({
      content: 'Summarize the following text:',
    });
  });

  it('maps a root-level prompt to just the source folder label', () => {
    const item = mapPromptToCatalogItem(
      makePrompt({ id: 'summarize', folderId: '' }),
      { t, source: PromptSource.Personal, favoriteIds: NO_FAVORITES },
    );

    expect(item.folder).toEqual(['Personal']);
  });

  it('marks a shared prompt as not editable', () => {
    const item = mapPromptToCatalogItem(makePrompt(), {
      t,
      source: PromptSource.SharedWithMe,
      favoriteIds: NO_FAVORITES,
    });

    expect(item.sharedWithMe).toBe(true);
    expect(item.isMyApp).toBe(false);
    expect(item.isEditable).toBe(false);
    expect(item.folder[0]).toBe('Shared with me');
  });

  it('marks an organisation prompt as not editable and not owned', () => {
    const item = mapPromptToCatalogItem(makePrompt(), {
      t,
      source: PromptSource.Public,
      favoriteIds: NO_FAVORITES,
    });

    expect(item.isMyApp).toBe(false);
    expect(item.sharedWithMe).toBe(false);
    expect(item.isEditable).toBe(false);
    expect(item.folder[0]).toBe('Organization');
  });

  it('leaves a prompt unfavourited when its path is not in favoriteIds', () => {
    for (const source of Object.values(PromptSource)) {
      const item = mapPromptToCatalogItem(makePrompt(), {
        t,
        source,
        favoriteIds: NO_FAVORITES,
      });
      expect(item.isUserFavorite).toBe(false);
      expect(item.isStarred).toBe(false);
    }
  });

  it('marks a prompt as favourited when its path is in favoriteIds', () => {
    for (const source of Object.values(PromptSource)) {
      const item = mapPromptToCatalogItem(makePrompt(), {
        t,
        source,
        favoriteIds: new Set(['Work/AI/summarize']),
      });
      expect(item.isUserFavorite).toBe(true);
      expect(item.isStarred).toBe(true);
    }
  });

  it('does not match a favourite id that only shares the prompt name', () => {
    const item = mapPromptToCatalogItem(makePrompt(), {
      t,
      source: PromptSource.Personal,
      favoriteIds: new Set(['summarize']),
    });

    expect(item.isUserFavorite).toBe(false);
  });

  it('leaves version empty and topics absent, which the backend does not expose', () => {
    const item = mapPromptToCatalogItem(makePrompt(), {
      t,
      source: PromptSource.Personal,
      favoriteIds: NO_FAVORITES,
    });

    expect(item.version).toBe('');
    expect(item.topics).toEqual([]);
  });

  it('falls back to an empty description when the prompt has none', () => {
    const item = mapPromptToCatalogItem(
      makePrompt({ description: undefined }),
      { t, source: PromptSource.Personal, favoriteIds: NO_FAVORITES },
    );

    expect(item.description).toBe('');
  });

  it('decodes percent-encoded folder segments', () => {
    const item = mapPromptToCatalogItem(
      makePrompt({ folderId: 'My%20Work/AI' }),
      { t, source: PromptSource.Personal, favoriteIds: NO_FAVORITES },
    );

    expect(item.folder).toEqual(['Personal', 'My Work', 'AI']);
  });
});

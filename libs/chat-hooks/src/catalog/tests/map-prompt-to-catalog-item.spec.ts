import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { PromptSource } from '../../prompt/prompt-resource';
import type { DeploymentFolderLabels } from '../map-deployment-to-catalog-item';
import {
  buildPromptOverview,
  mapPromptToCatalogItem,
  type PromptOverviewLabels,
} from '../map-prompt-to-catalog-item';

const folderLabels: DeploymentFolderLabels = {
  personal: 'Personal',
  shared: 'Shared with me',
  public: 'Organization',
};

const overviewLabels: PromptOverviewLabels = {
  authorLabel: 'Author',
  updatedLabel: 'Updated',
  sectionTitle: 'Prompt',
};

const NO_FAVORITES: ReadonlySet<string> = new Set();

const makePrompt = (
  overrides: Partial<PromptResponseDto> = {},
): PromptResponseDto => ({
  id: 'Work/AI/summarize',
  bucket: 'my-bucket',
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
      folderLabels,
      overviewLabels,
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
      {
        folderLabels,
        overviewLabels,
        source: PromptSource.Personal,
        favoriteIds: NO_FAVORITES,
      },
    );

    expect(item.folder).toEqual(['Personal']);
  });

  it('marks a shared prompt as not editable', () => {
    const item = mapPromptToCatalogItem(makePrompt(), {
      folderLabels,
      overviewLabels,
      source: PromptSource.SharedWithMe,
      favoriteIds: NO_FAVORITES,
    });

    expect(item.sharedWithMe).toBe(true);
    expect(item.isMyApp).toBe(false);
    expect(item.isEditable).toBe(false);
    expect(item.folder[0]).toBe('Shared with me');
  });

  it('marks a shared prompt with WRITE permission as editable', () => {
    const item = mapPromptToCatalogItem(makePrompt({ canEdit: true }), {
      folderLabels,
      overviewLabels,
      source: PromptSource.SharedWithMe,
      favoriteIds: NO_FAVORITES,
    });

    expect(item.isEditable).toBe(true);
  });

  it('qualifies a shared prompt id with the owner bucket', () => {
    const item = mapPromptToCatalogItem(
      makePrompt({ bucket: 'owner-bucket' }),
      {
        folderLabels,
        overviewLabels,
        source: PromptSource.SharedWithMe,
        favoriteIds: NO_FAVORITES,
      },
    );

    expect(item.id).toBe('prompts/owner-bucket/Work/AI/summarize');
  });

  it('keeps a shared prompt distinct from a personal prompt at the same path', () => {
    const options = { folderLabels, overviewLabels, favoriteIds: NO_FAVORITES };
    const personal = mapPromptToCatalogItem(makePrompt(), {
      ...options,
      source: PromptSource.Personal,
    });
    const shared = mapPromptToCatalogItem(
      makePrompt({ bucket: 'owner-bucket' }),
      {
        ...options,
        source: PromptSource.SharedWithMe,
      },
    );

    expect(shared.id).not.toBe(personal.id);
  });

  it('marks an organisation prompt as not editable and not owned', () => {
    const item = mapPromptToCatalogItem(makePrompt({ canEdit: true }), {
      folderLabels,
      overviewLabels,
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
        folderLabels,
        overviewLabels,
        source,
        favoriteIds: NO_FAVORITES,
      });
      expect(item.isUserFavorite).toBe(false);
      expect(item.isStarred).toBe(false);
    }
  });

  it('marks a prompt as favourited when its catalog id is in favoriteIds', () => {
    /* Favourites are keyed by the catalog id, which a shared prompt qualifies. */
    const favoriteIdBySource: Record<PromptSource, string> = {
      [PromptSource.Personal]: 'Work/AI/summarize',
      [PromptSource.SharedWithMe]: 'prompts/my-bucket/Work/AI/summarize',
      [PromptSource.Public]: 'Work/AI/summarize',
    };

    for (const source of Object.values(PromptSource)) {
      const item = mapPromptToCatalogItem(makePrompt(), {
        folderLabels,
        overviewLabels,
        source,
        favoriteIds: new Set([favoriteIdBySource[source]]),
      });
      expect(item.isUserFavorite).toBe(true);
      expect(item.isStarred).toBe(true);
    }
  });

  it('does not match a favourite id that only shares the prompt name', () => {
    const item = mapPromptToCatalogItem(makePrompt(), {
      folderLabels,
      overviewLabels,
      source: PromptSource.Personal,
      favoriteIds: new Set(['summarize']),
    });

    expect(item.isUserFavorite).toBe(false);
  });

  it('leaves version empty and topics absent, which the backend does not expose', () => {
    const item = mapPromptToCatalogItem(makePrompt(), {
      folderLabels,
      overviewLabels,
      source: PromptSource.Personal,
      favoriteIds: NO_FAVORITES,
    });

    expect(item.version).toBe('');
    expect(item.topics).toEqual([]);
  });

  it('falls back to an empty description when the prompt has none', () => {
    const item = mapPromptToCatalogItem(
      makePrompt({ description: undefined }),
      {
        folderLabels,
        overviewLabels,
        source: PromptSource.Personal,
        favoriteIds: NO_FAVORITES,
      },
    );

    expect(item.description).toBe('');
  });

  it('decodes percent-encoded folder segments', () => {
    const item = mapPromptToCatalogItem(
      makePrompt({ folderId: 'My%20Work/AI' }),
      {
        folderLabels,
        overviewLabels,
        source: PromptSource.Personal,
        favoriteIds: NO_FAVORITES,
      },
    );

    expect(item.folder).toEqual(['Personal', 'My Work', 'AI']);
  });
});

describe('buildPromptOverview', () => {
  it('lists the author above the last-updated row', () => {
    const { specs } = buildPromptOverview(
      makePrompt({ author: 'john.doe@example.com' }),
      overviewLabels,
    ).sections[0];

    expect(specs.map((spec) => spec.label)).toEqual(['Author', 'Updated']);
    expect(specs[0].value).toBe('john.doe@example.com');
  });

  it('omits the author row when the prompt has no author', () => {
    const { specs } = buildPromptOverview(makePrompt(), overviewLabels)
      .sections[0];

    expect(specs.map((spec) => spec.label)).toEqual(['Updated']);
  });

  it('shows neither a folder nor a source row', () => {
    const { specs } = buildPromptOverview(
      makePrompt({ author: 'john.doe@example.com' }),
      overviewLabels,
    ).sections[0];

    expect(specs).toHaveLength(2);
  });
});

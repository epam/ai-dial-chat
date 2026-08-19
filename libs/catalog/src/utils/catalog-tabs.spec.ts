import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../models/catalog-item';
import { buildCatalogTabs } from './catalog-tabs';

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

describe('buildCatalogTabs', () => {
  it('includes a Prompts tab when at least one prompt item is present', () => {
    const tabs = buildCatalogTabs([
      makeItem({ id: '1', name: 'GPT-4' }),
      makeItem({
        id: 'my-prompt',
        name: 'summarize',
        type: CatalogEntityType.Prompt,
      }),
    ]);

    expect(tabs).toEqual([
      { id: CatalogEntityType.Model, label: 'Models' },
      { id: CatalogEntityType.Prompt, label: 'Prompts' },
    ]);
  });

  it('omits the Prompts tab when no prompt items are present', () => {
    const tabs = buildCatalogTabs([
      makeItem({ id: '1', name: 'GPT-4' }),
      makeItem({ id: '2', name: 'Assistant', type: CatalogEntityType.Agent }),
    ]);

    expect(tabs.some((tab) => tab.id === CatalogEntityType.Prompt)).toBe(false);
  });

  it('orders the Prompts tab after Toolsets and before Skills', () => {
    const tabs = buildCatalogTabs([
      makeItem({ id: 'skill', name: 'Skill', type: CatalogEntityType.Skill }),
      makeItem({
        id: 'prompt',
        name: 'Prompt',
        type: CatalogEntityType.Prompt,
      }),
      makeItem({
        id: 'toolset',
        name: 'Toolset',
        type: CatalogEntityType.Toolset,
      }),
    ]);

    expect(tabs.map((tab) => tab.id)).toEqual([
      CatalogEntityType.Toolset,
      CatalogEntityType.Prompt,
      CatalogEntityType.Skill,
    ]);
  });

  it('prefers a host-supplied Prompts label over the English default', () => {
    const tabs = buildCatalogTabs(
      [
        makeItem({
          id: 'prompt',
          name: 'Prompt',
          type: CatalogEntityType.Prompt,
        }),
      ],
      { [CatalogEntityType.Prompt]: 'Подсказки' },
    );

    expect(tabs).toEqual([
      { id: CatalogEntityType.Prompt, label: 'Подсказки' },
    ]);
  });
});

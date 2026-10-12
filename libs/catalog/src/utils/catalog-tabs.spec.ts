import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../models/catalog-item';
import { buildCatalogTabs, scrollSelectedTabIntoView } from './catalog-tabs';

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

  it('orders the Prompts tab after Toolsets and Skills, as the last tab', () => {
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
      CatalogEntityType.Skill,
      CatalogEntityType.Prompt,
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

describe('scrollSelectedTabIntoView', () => {
  const rect = (left: number, right: number) => ({ left, right }) as DOMRect;

  const makeRow = (tabLeft: number, tabRight: number, scrollLeft = 0) => {
    const row = document.createElement('div');
    row.style.paddingInlineStart = '16px';
    row.style.paddingInlineEnd = '16px';
    row.getBoundingClientRect = () => rect(0, 360);
    const tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'true');
    tab.getBoundingClientRect = () => rect(tabLeft, tabRight);
    row.appendChild(tab);
    row.scrollLeft = scrollLeft;
    return row;
  };

  it('scrolls forward when the selected tab is past the end of the row', () => {
    const row = makeRow(380, 460);

    scrollSelectedTabIntoView(row);

    expect(row.scrollLeft).toBe(116);
  });

  it('scrolls back when the selected tab is before the start of the row', () => {
    const row = makeRow(-40, 40, 100);

    scrollSelectedTabIntoView(row);

    expect(row.scrollLeft).toBe(44);
  });

  it('leaves the row alone when the selected tab is already visible', () => {
    const row = makeRow(100, 200, 30);

    scrollSelectedTabIntoView(row);

    expect(row.scrollLeft).toBe(30);
  });
});

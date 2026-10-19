import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../models/catalog-item';
import type { CatalogItemTabData } from '../../models/item-details-data';
import { CatalogDetailsTab } from '../../types/detail-tab';
import { getCatalogDetailsTabs, hasConnectableApi } from '../details-tabs';

const makeItem = (
  type: CatalogEntityType,
  details?: CatalogItemTabData,
): CatalogItem => ({
  id: 'id',
  type,
  name: 'Item',
  version: '',
  lastUsed: '',
  description: '',
  folder: [],
  topics: [],
  details,
});

const OVERVIEW = { sections: [] };
const PRICING = { prices: [] };
const LIMITS = { groups: [] };
const TOOLS = { tools: [{ name: 'search' }] };
const CONNECTABLE_API = {
  resource: { endpointUrl: 'https://core/x' },
} as CatalogItemTabData['api'];
const ID_ONLY_API = { resource: {} } as CatalogItemTabData['api'];

const { About, Content, Overview, Pricing, Limits, Tools, Api } =
  CatalogDetailsTab;

describe('getCatalogDetailsTabs', () => {
  it.each<[string, CatalogItem, CatalogDetailsTab[]]>([
    [
      'a model before details resolve',
      makeItem(CatalogEntityType.Model),
      [About],
    ],
    [
      'a model with every field',
      makeItem(CatalogEntityType.Model, {
        overview: OVERVIEW,
        pricing: PRICING,
        limits: LIMITS,
        api: CONNECTABLE_API,
      }),
      [About, Overview, Pricing, Limits, Api],
    ],
    [
      'an agent with overview only',
      makeItem(CatalogEntityType.Agent, { overview: OVERVIEW }),
      [About, Overview],
    ],
    [
      'a toolset with tools',
      makeItem(CatalogEntityType.Toolset, { overview: OVERVIEW, tools: TOOLS }),
      [About, Overview, Tools],
    ],
    [
      'a skill before details resolve',
      makeItem(CatalogEntityType.Skill),
      [Content],
    ],
    [
      'a skill with an overview',
      makeItem(CatalogEntityType.Skill, { overview: OVERVIEW }),
      [Content, Overview],
    ],
    [
      'a prompt with its content',
      makeItem(CatalogEntityType.Prompt, { promptContent: { content: 'x' } }),
      [Content],
    ],
    [
      'a model whose api names no endpoint',
      makeItem(CatalogEntityType.Model, { api: ID_ONLY_API }),
      [About],
    ],
  ])('lists the tabs of %s', (_, item, expected) => {
    expect(getCatalogDetailsTabs(item)).toEqual(expected);
  });

  it('leaves out Connect for hosts that hide it', () => {
    const item = makeItem(CatalogEntityType.Model, {
      overview: OVERVIEW,
      api: CONNECTABLE_API,
    });

    expect(getCatalogDetailsTabs(item, { isConnectHidden: true })).toEqual([
      About,
      Overview,
    ]);
  });
});

describe('hasConnectableApi', () => {
  it('needs an endpoint URL or a non-empty endpoint list', () => {
    expect(hasConnectableApi(CONNECTABLE_API)).toBe(true);
    expect(
      hasConnectableApi({
        endpoints: [{ label: 'Core', url: 'https://core' }],
      }),
    ).toBe(true);
    expect(hasConnectableApi(ID_ONLY_API)).toBe(false);
    expect(hasConnectableApi(undefined)).toBe(false);
  });
});

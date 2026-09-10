import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import type { CatalogItem } from '../../models/catalog-item';
import {
  buildCatalogTabs,
  CatalogSortKey,
  CredentialsLevel,
  CredentialStatus,
  filterCatalogItems,
  getSignedInLevel,
  sortCatalogItems,
  ToolsetAuthenticationType,
} from '../mapping';

/**
 * Exercises `@epam/ai-dial-catalog/mapping`'s public re-export surface
 * through the entry point itself (tasks.md §2.2) — a regression guard for
 * the barrel's own export list, distinct from `utils/catalog-tabs.spec.ts`
 * and its siblings, which test each function's behavior via its own source
 * module. `CredentialsLevel`/`CatalogSortKey`/`CredentialStatus`/
 * `ToolsetAuthenticationType` are imported from `../mapping`, not from
 * `../types/toolset-auth`/`../types/sort`, specifically to confirm the entry
 * point re-exports them.
 */

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

describe('@epam/ai-dial-catalog/mapping entry point', () => {
  it('re-exports the CredentialsLevel enum with its real values', () => {
    expect(CredentialsLevel.User).toBe('USER');
    expect(CredentialsLevel.Global).toBe('GLOBAL');
  });

  it('re-exports filterCatalogItems, sortCatalogItems and buildCatalogTabs as working functions', () => {
    const items = [
      makeItem({ id: '1', name: 'Beta', type: CatalogEntityType.Model }),
      makeItem({ id: '2', name: 'Alpha', type: CatalogEntityType.Prompt }),
    ];

    const filtered = filterCatalogItems(items, 'alpha');
    expect(filtered.map((item) => item.id)).toEqual(['2']);

    const sorted = sortCatalogItems(items, CatalogSortKey.NameAZ);
    expect(sorted.map((item) => item.id)).toEqual(['2', '1']);

    const tabs = buildCatalogTabs(items);
    expect(tabs.map((tab) => tab.id)).toEqual([
      CatalogEntityType.Model,
      CatalogEntityType.Prompt,
    ]);
  });

  it('re-exports getSignedInLevel as a working function', () => {
    expect(
      getSignedInLevel({
        authenticationType: ToolsetAuthenticationType.ApiKey,
        userStatus: CredentialStatus.SignedIn,
      }),
    ).toBe(CredentialsLevel.User);
    expect(
      getSignedInLevel({
        authenticationType: ToolsetAuthenticationType.ApiKey,
        userStatus: CredentialStatus.SignedOut,
      }),
    ).toBe(CredentialsLevel.Global);
  });
});

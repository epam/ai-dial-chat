import { CatalogEntityType } from '@epam/ai-dial-catalog';
import type { DialToolsetDto } from '@epam/chat-api-client';
import { describe, expect, it } from 'vitest';
import { mapToolsetToCatalogItem } from '../map-deployment-to-catalog-item';

describe('mapToolsetToCatalogItem', () => {
  it('maps real SDK-shaped toolset data into catalog fields', () => {
    const toolset: DialToolsetDto = {
      id: 'toolsets/bucket/folder/salesforce',
      toolset: 'toolsets/bucket/folder/salesforce',
      displayName: 'salesforce',
      description: '',
      reference: 'salesforce',
      updatedAt: 1782803923271,
      descriptionKeywords: ['crm'],
      allowedTools: ['query_accounts', 'create_lead'],
      isMy: true,
      authSettings: {
        authenticationType: 'OAUTH',
        clientId: 'client-id',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        authorizationEndpoint: 'https://example.com/authorize',
        globalAuthStatus: 'SIGNED_OUT',
        userLevelAuthStatus: 'SIGNED_OUT',
      },
    };

    const result = mapToolsetToCatalogItem(toolset);

    expect(result).toMatchObject({
      id: 'toolsets/bucket/folder/salesforce',
      type: CatalogEntityType.Toolset,
      name: 'salesforce',
      topics: ['crm'],
      folder: ['folder'],
      isMyApp: true,
      updatedAt: 1782803923271,
      details: {
        tools: {
          tools: [{ name: 'query_accounts' }, { name: 'create_lead' }],
        },
      },
    });
  });

  it('keeps root-level toolsets without a folder', () => {
    const result = mapToolsetToCatalogItem({
      id: 'salesforce',
      toolset: 'salesforce',
    });

    expect(result.folder).toEqual([]);
    expect(result.name).toBe('salesforce');
  });
});

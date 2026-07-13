import {
  CatalogEntityType,
  CredentialStatus,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';
import type { DeploymentItemDto, DialToolsetDto } from '@epam/chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  mapDeploymentToCatalogItem,
  mapToolsetCredentials,
  mapToolsetToCatalogItem,
} from '../map-deployment-to-catalog-item';

describe('mapDeploymentToCatalogItem', () => {
  it('maps the intro field onto the catalog item', () => {
    const deployment: DeploymentItemDto = {
      id: 'model-1',
      type: 'model',
      displayName: 'Model 1',
      description: 'Short description',
      intro: 'A longer intro for the details panel.',
    };

    const result = mapDeploymentToCatalogItem(deployment);

    expect(result.description).toBe('Short description');
    expect(result.intro).toBe('A longer intro for the details panel.');
  });

  const baseDeployment: DeploymentItemDto = {
    id: 'applications/bucket/My App__1.0',
    displayName: 'My App',
    type: 'application',
    isMy: true,
    applicationTypeSchemaId: 'schemas/quickapps2',
  };

  it('marks a deployment editable when it is the user’s own app built from the given schema', () => {
    const result = mapDeploymentToCatalogItem(
      baseDeployment,
      undefined,
      undefined,
      undefined,
      'schemas/quickapps2',
    );

    expect(result.isEditable).toBe(true);
  });

  it('is not editable when the app was built from a different schema', () => {
    const result = mapDeploymentToCatalogItem(
      baseDeployment,
      undefined,
      undefined,
      undefined,
      'schemas/other',
    );

    expect(result.isEditable).toBe(false);
  });

  it('is not editable when the deployment does not belong to the current user', () => {
    const result = mapDeploymentToCatalogItem(
      { ...baseDeployment, isMy: false },
      undefined,
      undefined,
      undefined,
      'schemas/quickapps2',
    );

    expect(result.isEditable).toBe(false);
  });

  it('is not editable when no editable schema id is supplied', () => {
    const result = mapDeploymentToCatalogItem(baseDeployment);

    expect(result.isEditable).toBe(false);
  });
});

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
      isEditable: true,
      updatedAt: 1782803923271,
      details: {
        tools: {
          tools: [{ name: 'query_accounts' }, { name: 'create_lead' }],
        },
      },
    });
  });

  it('marks a toolset owned by another user as not editable', () => {
    const result = mapToolsetToCatalogItem({
      id: 'salesforce',
      toolset: 'salesforce',
      isMy: false,
    });

    expect(result.isEditable).toBe(false);
  });

  it('keeps root-level toolsets without a folder', () => {
    const result = mapToolsetToCatalogItem({
      id: 'salesforce',
      toolset: 'salesforce',
    });

    expect(result.folder).toEqual([]);
    expect(result.name).toBe('salesforce');
  });

  it('maps the intro field onto the catalog item', () => {
    const result = mapToolsetToCatalogItem({
      id: 'salesforce',
      toolset: 'salesforce',
      intro: 'A longer intro for the details panel.',
    });

    expect(result.intro).toBe('A longer intro for the details panel.');
  });

  it('marks a public toolset as isPublic and manageable by an admin', () => {
    const result = mapToolsetToCatalogItem(
      {
        id: 'toolsets/public/search__0.0.1',
        toolset: 'toolsets/public/search__0.0.1',
        authSettings: { authenticationType: 'API_KEY' },
      },
      undefined,
      true,
    );

    expect(result.credentials).toMatchObject({
      isPublic: true,
      isManageableByAdmin: true,
    });
  });

  it('does not mark a public toolset as manageable for a non-admin', () => {
    const result = mapToolsetToCatalogItem(
      {
        id: 'toolsets/public/search__0.0.1',
        toolset: 'toolsets/public/search__0.0.1',
        authSettings: { authenticationType: 'API_KEY' },
      },
      undefined,
      false,
    );

    expect(result.credentials).toMatchObject({
      isPublic: true,
      isManageableByAdmin: false,
    });
  });

  it('does not mark a private toolset as public even for an admin', () => {
    const result = mapToolsetToCatalogItem(
      {
        id: 'toolsets/bucket/search__0.0.1',
        toolset: 'toolsets/bucket/search__0.0.1',
        authSettings: { authenticationType: 'API_KEY' },
      },
      undefined,
      true,
    );

    expect(result.credentials).toMatchObject({
      isPublic: false,
      isManageableByAdmin: false,
    });
  });

  it('maps both USER and GLOBAL sign-in status', () => {
    const result = mapToolsetToCatalogItem({
      id: 'toolsets/public/search__0.0.1',
      toolset: 'toolsets/public/search__0.0.1',
      authSettings: {
        authenticationType: 'API_KEY',
        userLevelAuthStatus: 'SIGNED_OUT',
        globalAuthStatus: 'SIGNED_IN',
      },
    });

    expect(result.credentials).toMatchObject({
      userStatus: CredentialStatus.SignedOut,
      globalStatus: CredentialStatus.SignedIn,
    });
  });

  it('maps the API key header hint', () => {
    const result = mapToolsetToCatalogItem({
      id: 'toolsets/bucket/search__0.0.1',
      toolset: 'toolsets/bucket/search__0.0.1',
      authSettings: {
        authenticationType: 'API_KEY',
        apiKeyHeader: 'X-Api-Key',
      },
    });

    expect(result.credentials).toMatchObject({ apiKeyHeader: 'X-Api-Key' });
  });
});

describe('mapToolsetCredentials', () => {
  it('returns undefined when authSettings is absent', () => {
    expect(
      mapToolsetCredentials('toolsets/public/x__1.0', undefined, false),
    ).toBeUndefined();
  });

  it('maps authenticationType and both status levels', () => {
    const result = mapToolsetCredentials(
      'toolsets/public/x__1.0',
      {
        authenticationType: 'OAUTH',
        userLevelAuthStatus: 'SIGNED_IN',
        globalAuthStatus: 'SIGNED_OUT',
      },
      true,
    );

    expect(result).toMatchObject({
      authenticationType: ToolsetAuthenticationType.OAuth,
      userStatus: CredentialStatus.SignedIn,
      globalStatus: CredentialStatus.SignedOut,
      isPublic: true,
      isManageableByAdmin: true,
    });
  });
});

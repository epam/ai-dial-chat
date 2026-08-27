import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';
import type {
  DeploymentItemDto,
  DialToolsetDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  mapDeploymentToCatalogItem,
  mapDeploymentToolsetCredentials,
  mapToolsetToCatalogItem,
  type DeploymentFolderLabels,
} from '../map-deployment-to-catalog-item';

const folderLabels: DeploymentFolderLabels = {
  personal: 'Personal',
  shared: 'Shared',
  public: 'Public',
};

const resolveIconUrl = (iconUrl: string | undefined): string | undefined =>
  iconUrl;

describe('mapDeploymentToCatalogItem', () => {
  const baseDeployment: DeploymentItemDto = {
    id: 'applications/bucket/My App__1.0',
    displayName: 'My App',
    type: 'application',
    isMy: true,
    applicationTypeSchemaId: 'schemas/quickapps2',
  };

  const mapItem = (
    deployment: DeploymentItemDto,
    overrides: Partial<
      Omit<Parameters<typeof mapDeploymentToCatalogItem>[1], 'resolveIconUrl'>
    > = {},
  ) =>
    mapDeploymentToCatalogItem(deployment, {
      folderLabels,
      activeLocale: 'en',
      primaryLocale: 'en',
      resolveIconUrl,
      ...overrides,
    });

  it('marks a deployment editable when it is the user’s own app built from the given schema', () => {
    const result = mapItem(baseDeployment, {
      editableSchemaIds: ['schemas/quickapps2'],
    });

    expect(result.isEditable).toBe(true);
  });

  it('is not editable when the app was built from a different schema', () => {
    const result = mapItem(baseDeployment, {
      editableSchemaIds: ['schemas/other'],
    });

    expect(result.isEditable).toBe(false);
  });

  it('is not editable when the deployment does not belong to the current user', () => {
    const result = mapItem(
      { ...baseDeployment, isMy: false },
      { editableSchemaIds: ['schemas/quickapps2'] },
    );

    expect(result.isEditable).toBe(false);
  });

  it('is not editable when no editable schema id is supplied', () => {
    const result = mapItem(baseDeployment);

    expect(result.isEditable).toBe(false);
  });

  it('marks a shared deployment editable when the user has WRITE access', () => {
    const result = mapItem(
      { ...baseDeployment, isMy: false, canEdit: true },
      { editableSchemaIds: ['schemas/quickapps2'] },
    );

    expect(result.isEditable).toBe(true);
  });

  it('is not editable when shared with only READ access', () => {
    const result = mapItem(
      { ...baseDeployment, isMy: false, canEdit: false },
      { editableSchemaIds: ['schemas/quickapps2'] },
    );

    expect(result.isEditable).toBe(false);
  });

  it('marks a custom app (no schema id) editable when the user owns it and isCustomAppsEditable is true', () => {
    const result = mapItem(
      {
        id: 'applications/bucket/My Custom App',
        displayName: 'My Custom App',
        type: 'application',
        isMy: true,
      },
      { isCustomAppsEditable: true },
    );

    expect(result.isEditable).toBe(true);
  });

  it('does not mark a custom app editable when isCustomAppsEditable is false', () => {
    const result = mapItem(
      {
        id: 'applications/bucket/My Custom App',
        displayName: 'My Custom App',
        type: 'application',
        isMy: true,
      },
      { isCustomAppsEditable: false },
    );

    expect(result.isEditable).toBe(false);
  });

  it('does not mark a custom app editable when the user does not own it', () => {
    const result = mapItem(
      {
        id: 'applications/bucket/Some App',
        displayName: 'Some App',
        type: 'application',
        isMy: false,
      },
      { isCustomAppsEditable: true },
    );

    expect(result.isEditable).toBe(false);
  });

  it('carries sharedWithMe through from the deployment DTO', () => {
    const result = mapItem({
      ...baseDeployment,
      isMy: false,
      sharedWithMe: true,
    });

    expect(result.sharedWithMe).toBe(true);
  });

  it('defaults sharedWithMe to false when the field is absent from the DTO', () => {
    const result = mapItem(baseDeployment);

    expect(result.sharedWithMe).toBe(false);
  });

  it('replaces the owner bucket with the Shared folder for a shared application', () => {
    const result = mapItem({
      ...baseDeployment,
      isMy: false,
      sharedWithMe: true,
      applicationFolder: 'applications/internal-owner-bucket/team',
    });

    expect(result.folder).toEqual(['Shared', 'team']);
    expect(result.folder).not.toContain('internal-owner-bucket');
  });

  it('uses only the Shared folder when a shared application has no folder metadata', () => {
    const result = mapItem({
      ...baseDeployment,
      isMy: false,
      sharedWithMe: true,
      applicationFolder: undefined,
    });

    expect(result.folder).toEqual(['Shared']);
  });

  it('keeps the Personal folder for an owned application', () => {
    const result = mapItem({
      ...baseDeployment,
      applicationFolder: 'applications/internal-owner-bucket/team',
    });

    expect(result.folder).toEqual(['Personal']);
  });

  it('keeps readable nested folders for a public application', () => {
    const result = mapItem({
      ...baseDeployment,
      isMy: false,
      applicationFolder: 'applications/public/team',
    });

    expect(result.folder).toEqual(['Public', 'team']);
  });

  it('never exposes the raw bucket ID for a shared application with a nested storage path', () => {
    const result = mapItem({
      ...baseDeployment,
      isMy: false,
      sharedWithMe: true,
      applicationFolder:
        'applications/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/appdata/quick-apps',
    });

    expect(result.folder).toEqual(['Shared', 'appdata', 'quick-apps']);
    expect(result.folder).not.toContain(
      '8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW',
    );
  });

  it('sets supportsMcp to true when the deployment reports features.mcp true', () => {
    const result = mapItem({
      ...baseDeployment,
      features: { systemPrompt: false, temperature: false, mcp: true },
    });

    expect(result.supportsMcp).toBe(true);
  });

  it('sets supportsMcp to false when features.mcp is absent', () => {
    const result = mapItem(baseDeployment);

    expect(result.supportsMcp).toBe(false);
  });

  it('sets supportsChat to true when interfaces includes chat', () => {
    const result = mapItem({
      ...baseDeployment,
      interfaces: ['chat', 'mcp'],
    });

    expect(result.supportsChat).toBe(true);
  });

  it('sets supportsChat to false when interfaces does not include chat', () => {
    const result = mapItem({ ...baseDeployment, interfaces: ['mcp'] });

    expect(result.supportsChat).toBe(false);
  });

  it('sets supportsChat to true when interfaces is absent', () => {
    const result = mapItem(baseDeployment);

    expect(result.supportsChat).toBe(true);
  });
});

describe('mapToolsetToCatalogItem', () => {
  const mapItem = (
    toolset: DialToolsetDto,
    overrides: Partial<
      Omit<Parameters<typeof mapToolsetToCatalogItem>[1], 'resolveIconUrl'>
    > = {},
  ) =>
    mapToolsetToCatalogItem(toolset, {
      activeLocale: 'en',
      primaryLocale: 'en',
      resolveIconUrl,
      ...overrides,
    });

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

    const result = mapItem(toolset);

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
    const result = mapItem({
      id: 'salesforce',
      toolset: 'salesforce',
      isMy: false,
    });

    expect(result.isEditable).toBe(false);
  });

  it('marks a shared toolset editable when the user has WRITE access', () => {
    const result = mapItem({
      id: 'salesforce',
      toolset: 'salesforce',
      isMy: false,
      canEdit: true,
    });

    expect(result.isEditable).toBe(true);
  });

  it('carries sharedWithMe through from the toolset DTO', () => {
    const result = mapItem({
      id: 'salesforce',
      toolset: 'salesforce',
      isMy: false,
      sharedWithMe: true,
    });

    expect(result.sharedWithMe).toBe(true);
  });

  it('defaults sharedWithMe to false when the field is absent from the toolset DTO', () => {
    const result = mapItem({ id: 'salesforce', toolset: 'salesforce' });

    expect(result.sharedWithMe).toBe(false);
  });

  it('keeps root-level toolsets without a folder', () => {
    const result = mapItem({ id: 'salesforce', toolset: 'salesforce' });

    expect(result.folder).toEqual([]);
    expect(result.name).toBe('salesforce');
  });

  it('places a toolset owned by the current user under the Personal folder', () => {
    const result = mapItem(
      {
        id: 'toolsets/bucket/folder/salesforce',
        toolset: 'toolsets/bucket/folder/salesforce',
        isMy: true,
      },
      { folderLabels },
    );

    expect(result.folder).toEqual(['Personal']);
  });

  it('shows the Shared folder for a shared toolset with no nested folder', () => {
    const result = mapItem(
      {
        id: 'toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/my-toolset__0.0.1',
        toolset:
          'toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/my-toolset__0.0.1',
        isMy: false,
        sharedWithMe: true,
      },
      { isAdmin: false, folderLabels },
    );

    expect(result.folder).toEqual(['Shared']);
  });

  it('shows the Shared folder plus the nested path for a shared toolset', () => {
    const result = mapItem(
      {
        id: 'toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/team/my-toolset__0.0.1',
        toolset:
          'toolsets/8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW/team/my-toolset__0.0.1',
        isMy: false,
        sharedWithMe: true,
      },
      { isAdmin: false, folderLabels },
    );

    expect(result.folder).toEqual(['Shared', 'team']);
    expect(result.folder).not.toContain(
      '8icWyDTafGxYQfmL4ZdHYbxsDCxTMXjgjFCSW',
    );
  });

  it('marks a public toolset as isPublic and manageable by an admin', () => {
    const result = mapItem(
      {
        id: 'toolsets/public/search__0.0.1',
        toolset: 'toolsets/public/search__0.0.1',
        authSettings: { authenticationType: 'API_KEY' },
      },
      { isAdmin: true },
    );

    expect(result.credentials).toMatchObject({
      isPublic: true,
      isManageableByAdmin: true,
    });
  });

  it('does not mark a public toolset as manageable for a non-admin', () => {
    const result = mapItem(
      {
        id: 'toolsets/public/search__0.0.1',
        toolset: 'toolsets/public/search__0.0.1',
        authSettings: { authenticationType: 'API_KEY' },
      },
      { isAdmin: false },
    );

    expect(result.credentials).toMatchObject({
      isPublic: true,
      isManageableByAdmin: false,
    });
  });

  it('does not mark a private toolset as public even for an admin', () => {
    const result = mapItem(
      {
        id: 'toolsets/bucket/search__0.0.1',
        toolset: 'toolsets/bucket/search__0.0.1',
        authSettings: { authenticationType: 'API_KEY' },
      },
      { isAdmin: true },
    );

    expect(result.credentials).toMatchObject({
      isPublic: false,
      isManageableByAdmin: false,
    });
  });

  it('maps both USER and GLOBAL sign-in status', () => {
    const result = mapItem({
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
    const result = mapItem({
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

describe('mapDeploymentToolsetCredentials', () => {
  it('returns undefined when authSettings is absent', () => {
    expect(
      mapDeploymentToolsetCredentials(
        'toolsets/public/x__1.0',
        undefined,
        false,
      ),
    ).toBeUndefined();
  });

  it('maps authenticationType and both status levels', () => {
    const result = mapDeploymentToolsetCredentials(
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

  it('reports authenticationType None for a non-admin already covered by global auth, hiding the login CTA', () => {
    const result = mapDeploymentToolsetCredentials(
      'toolsets/public/x__1.0',
      {
        authenticationType: 'OAUTH',
        userLevelAuthStatus: 'SIGNED_OUT',
        globalAuthStatus: 'SIGNED_IN',
      },
      false,
    );

    expect(result).toMatchObject({
      authenticationType: ToolsetAuthenticationType.None,
      userStatus: CredentialStatus.SignedOut,
      globalStatus: CredentialStatus.SignedIn,
    });
  });

  it('keeps the real authenticationType for an admin even when global auth is signed in', () => {
    const result = mapDeploymentToolsetCredentials(
      'toolsets/public/x__1.0',
      {
        authenticationType: 'OAUTH',
        userLevelAuthStatus: 'SIGNED_OUT',
        globalAuthStatus: 'SIGNED_IN',
      },
      true,
    );

    expect(result).toMatchObject({
      authenticationType: ToolsetAuthenticationType.OAuth,
    });
  });

  it('keeps the real authenticationType when the user is already personally signed in, even if global is also signed in', () => {
    const result = mapDeploymentToolsetCredentials(
      'toolsets/public/x__1.0',
      {
        authenticationType: 'OAUTH',
        userLevelAuthStatus: 'SIGNED_IN',
        globalAuthStatus: 'SIGNED_IN',
      },
      false,
    );

    expect(result).toMatchObject({
      authenticationType: ToolsetAuthenticationType.OAuth,
    });
  });

  it('keeps the real authenticationType for a non-public toolset even when global is signed in', () => {
    const result = mapDeploymentToolsetCredentials(
      'toolsets/personal-bucket/x__1.0',
      {
        authenticationType: 'OAUTH',
        userLevelAuthStatus: 'SIGNED_OUT',
        globalAuthStatus: 'SIGNED_IN',
      },
      false,
    );

    expect(result).toMatchObject({
      authenticationType: ToolsetAuthenticationType.OAuth,
      isPublic: false,
    });
  });
});

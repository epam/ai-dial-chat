import {
  CredentialStatus,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';
import { describe, expect, it } from 'vitest';
import {
  AuthenticationType,
  ModelEndpointType,
  type ToolsetAuthStatus,
  type ToolsetEntityDetails,
} from '../../types/entity-details';
import {
  mapEntityDetailsToCatalogDetails,
  mapToolsetCredentials,
} from '../map-entity-details-to-catalog';

describe('mapEntityDetailsToCatalogDetails', () => {
  describe('AGENT', () => {
    it('maps endpoint-type variants (Azure OpenAI / Anthropic / Responses) the same way as a model', () => {
      const result = mapEntityDetailsToCatalogDetails({
        type: 'AGENT',
        data: {
          api: {
            endpoints: [
              {
                type: ModelEndpointType.AzureOpenAI,
                url: 'https://dial.example.com/openai/deployments/my-agent',
              },
              {
                type: ModelEndpointType.Anthropic,
                url: 'https://dial.example.com/anthropic/deployments/my-agent',
              },
              {
                type: ModelEndpointType.Responses,
                url: 'https://dial.example.com/openai/deployments/my-agent/responses',
              },
            ],
          },
        },
      });

      expect(result.api?.endpoints).toEqual([
        {
          label: 'Azure OpenAI Endpoint',
          url: 'https://dial.example.com/openai/deployments/my-agent',
          snippets: [],
        },
        {
          label: 'Anthropic Endpoint',
          url: 'https://dial.example.com/anthropic/deployments/my-agent',
          snippets: [],
        },
        {
          label: 'Responses Endpoint',
          url: 'https://dial.example.com/openai/deployments/my-agent/responses',
          snippets: [],
        },
      ]);
    });

    it('falls back to the single endpointUrl when no endpoint-type variants are present', () => {
      const result = mapEntityDetailsToCatalogDetails({
        type: 'AGENT',
        data: {
          api: { endpointUrl: 'https://dial.example.com/deployments/my-agent' },
        },
      });

      expect(result.api?.endpoints).toBeUndefined();
      expect(result.api?.resource).toEqual({
        endpointUrl: 'https://dial.example.com/deployments/my-agent',
      });
    });
  });

  describe('MODEL', () => {
    it('maps endpoint-type variants the same way as an agent', () => {
      const result = mapEntityDetailsToCatalogDetails({
        type: 'MODEL',
        data: {
          api: {
            modelId: 'gpt-4o',
            endpoints: [
              {
                type: ModelEndpointType.AzureOpenAI,
                url: 'https://dial.example.com/openai/deployments/gpt-4o',
              },
            ],
          },
        },
      });

      expect(result.api?.endpoints).toEqual([
        {
          label: 'Azure OpenAI Endpoint',
          url: 'https://dial.example.com/openai/deployments/gpt-4o',
          snippets: [],
        },
      ]);
    });
  });

  describe('TOOLSET', () => {
    it('maps the allow-listed tools into Tools tab data', () => {
      const result = mapEntityDetailsToCatalogDetails({
        type: 'TOOLSET',
        data: {
          specification: {
            permissions: ['search', 'fetch'],
            allTools: ['search', 'fetch', 'browse'],
          },
        },
      });

      expect(result.tools).toEqual({
        tools: [{ name: 'search' }, { name: 'fetch' }],
      });
    });

    it('falls back to every supported tool when no allow-list is set', () => {
      const result = mapEntityDetailsToCatalogDetails({
        type: 'TOOLSET',
        data: {
          specification: {
            permissions: [],
            allTools: ['search', 'fetch', 'browse'],
          },
        },
      });

      expect(result.tools).toEqual({
        tools: [{ name: 'search' }, { name: 'fetch' }, { name: 'browse' }],
      });
    });

    it('omits Tools tab data when the toolset reports no tools', () => {
      const result = mapEntityDetailsToCatalogDetails({
        type: 'TOOLSET',
        data: { specification: { provider: 'Anthropic' } },
      });

      expect(result.tools).toBeUndefined();
    });

    it('does not duplicate tool names as Overview specification rows', () => {
      const result = mapEntityDetailsToCatalogDetails({
        type: 'TOOLSET',
        data: {
          specification: {
            permissions: ['search'],
            allTools: ['search', 'browse'],
          },
        },
      });

      const labels = (result.overview?.sections ?? []).flatMap((section) =>
        section.specs.map((spec) => spec.label),
      );
      expect(labels).not.toContain('Allowed tools');
      expect(labels).not.toContain('All supported tools');
    });
  });
});

describe('mapToolsetCredentials', () => {
  const makeData = (authStatus: ToolsetAuthStatus): ToolsetEntityDetails => ({
    specification: {
      authentication: AuthenticationType.ApiKey,
      authStatus,
    },
  });

  it('mocks userApiKeyAddedWhen/globalApiKeyAddedWhen for a signed-in API-key toolset', () => {
    const result = mapToolsetCredentials(
      'toolsets/public/x__1.0',
      makeData({ userLevel: 'SIGNED_IN', global: 'SIGNED_IN' }),
      true,
    );

    expect(result).toMatchObject({
      authenticationType: ToolsetAuthenticationType.ApiKey,
      userApiKeyAddedWhen: '3 weeks ago',
      globalApiKeyAddedWhen: '1 week ago',
    });
  });

  it('omits userApiKeyAddedWhen/globalApiKeyAddedWhen when signed out', () => {
    const result = mapToolsetCredentials(
      'toolsets/public/x__1.0',
      makeData({ userLevel: 'SIGNED_OUT', global: 'SIGNED_OUT' }),
      true,
    );

    expect(result?.userApiKeyAddedWhen).toBeUndefined();
    expect(result?.globalApiKeyAddedWhen).toBeUndefined();
  });

  it('omits userApiKeyAddedWhen/globalApiKeyAddedWhen for OAuth toolsets', () => {
    const result = mapToolsetCredentials(
      'toolsets/public/x__1.0',
      {
        specification: {
          authentication: AuthenticationType.OAuth,
          authStatus: { userLevel: 'SIGNED_IN', global: 'SIGNED_IN' },
        },
      },
      true,
    );

    expect(result?.userApiKeyAddedWhen).toBeUndefined();
    expect(result?.globalApiKeyAddedWhen).toBeUndefined();
  });

  it('maps status levels as before', () => {
    const result = mapToolsetCredentials(
      'toolsets/public/x__1.0',
      makeData({ userLevel: 'SIGNED_IN', global: 'SIGNED_OUT' }),
      true,
    );

    expect(result).toMatchObject({
      userStatus: CredentialStatus.SignedIn,
      globalStatus: CredentialStatus.SignedOut,
      isPublic: true,
      isManageableByAdmin: true,
    });
  });
});

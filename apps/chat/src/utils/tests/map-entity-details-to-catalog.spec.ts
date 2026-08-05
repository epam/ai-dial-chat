import { describe, expect, it } from 'vitest';
import { ModelEndpointType } from '../../types/entity-details';
import { mapEntityDetailsToCatalogDetails } from '../map-entity-details-to-catalog';

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
});

import { describe, expect, it } from 'vitest';
import { ModelEndpointType } from '../../types/entity-details';
import {
  mapDeploymentDetailsDtoToEntityDetails,
  mapEntityDetailsToCatalogDetails,
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

  describe('MODEL pricing', () => {
    const mapPricingRows = (pricing: {
      unit?: string;
      prompt?: string;
      completion?: string;
    }) => {
      const dto: Parameters<typeof mapDeploymentDetailsDtoToEntityDetails>[0] =
        {
          id: 'gpt-4o',
          type: 'model',
          modelDetails: { pricing },
        };

      return mapEntityDetailsToCatalogDetails(
        mapDeploymentDetailsDtoToEntityDetails(dto),
      ).pricing?.prices;
    };

    it('quotes token prices per 1M tokens', () => {
      expect(
        mapPricingRows({
          unit: 'token',
          prompt: '0.000003',
          completion: '0.000015',
        }),
      ).toEqual([
        { label: 'Input tokens', price: '$3/M tokens' },
        { label: 'Output tokens', price: '$15/M tokens' },
      ]);
    });

    it('keeps sub-dollar per-1M prices readable', () => {
      expect(mapPricingRows({ unit: 'token', prompt: '0.00000005' })).toEqual([
        { label: 'Input tokens', price: '$0.05/M tokens' },
      ]);
    });

    it('treats a missing unit as token pricing', () => {
      expect(mapPricingRows({ prompt: '0.0000025' })).toEqual([
        { label: 'Input tokens', price: '$2.5/M tokens' },
      ]);
    });

    it('names non-token units instead of re-quoting them per 1M tokens', () => {
      expect(
        mapPricingRows({
          unit: 'char_without_whitespace',
          prompt: '0.000002',
        }),
      ).toEqual([
        {
          label: 'Input tokens',
          price: '$0.000002/char without whitespace',
        },
      ]);
    });

    it('passes a non-numeric price through unchanged', () => {
      expect(mapPricingRows({ unit: 'token', prompt: 'Free' })).toEqual([
        { label: 'Input tokens', price: 'Free' },
      ]);
    });

    it('omits the Pricing tab when the deployment reports no pricing', () => {
      expect(mapPricingRows({})).toBeUndefined();
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

import { describe, expect, it } from 'vitest';
import {
  mapDeploymentDetailsDtoToEntityDetails,
  mapEntityDetailsToCatalogDetails,
} from '../map-entity-details-to-catalog';

describe('mapEntityDetailsToCatalogDetails', () => {
  describe('AGENT', () => {
    it('maps the single endpointUrl into the API resource', () => {
      const result = mapEntityDetailsToCatalogDetails({
        type: 'AGENT',
        data: {
          api: { endpointUrl: 'https://dial.example.com/deployments/my-agent' },
        },
      });

      expect(result.api?.resource).toEqual({
        endpointUrl: 'https://dial.example.com/deployments/my-agent',
      });
    });
  });

  describe('MODEL', () => {
    it('maps the model id into the API resource', () => {
      const result = mapEntityDetailsToCatalogDetails({
        type: 'MODEL',
        data: { api: { modelId: 'gpt-4o' } },
      });

      expect(result.api?.resource).toEqual({ modelId: 'gpt-4o' });
    });

    it('maps known catalog properties into Overview Specification rows', () => {
      const dto: Parameters<typeof mapDeploymentDetailsDtoToEntityDetails>[0] =
        {
          id: 'als-regre-19-adapter',
          type: 'model',
          modelDetails: {
            catalogProperties: {
              provider: 'Provider',
              vendor: 'Vendor',
              license: 'License',
              knowledgeCutoffDate: '2026-08-17',
            },
          },
        };

      const result = mapEntityDetailsToCatalogDetails(
        mapDeploymentDetailsDtoToEntityDetails(dto),
      );

      expect(result.overview?.sections).toEqual([
        {
          title: 'Specification',
          specs: [
            { label: 'Provider', value: 'Provider' },
            { label: 'Vendor', value: 'Vendor' },
            { label: 'License', value: 'License' },
            {
              label: 'Knowledge cutoff date',
              value: '2026-08-17',
            },
          ],
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

import { describe, expect, it } from 'vitest';
import * as mapping from '../entry-points/mapping';
import * as catalog from '../index';

describe('@epam/ai-dial-catalog public details-tab surface', () => {
  it.each([
    'AboutTab',
    'ContentTab',
    'LimitsTab',
    'OverviewTab',
    'PricingTab',
    'ToolsTab',
  ])('exports %s from the package root', (name) => {
    expect(typeof (catalog as Record<string, unknown>)[name]).toBe('function');
  });

  it('exports the details tab rule from the headless entry point and the root', () => {
    expect(typeof mapping.getCatalogDetailsTabs).toBe('function');
    expect(catalog.getCatalogDetailsTabs).toBe(mapping.getCatalogDetailsTabs);
    expect(mapping.CatalogDetailsTab.Tools).toBe('tools');
  });
});

describe('@epam/ai-dial-catalog public header, Connect and credentials surface', () => {
  it.each([
    'ApiTab',
    'DetailsHeader',
    'CredentialsBanner',
    'CredentialsApiKeyOverlay',
    'CredentialsManagementPanel',
  ])('exports %s from the package root', (name) => {
    expect(typeof (catalog as Record<string, unknown>)[name]).toBe('function');
  });

  it('exports the credentials banner rule from the headless entry point and the root', () => {
    expect(typeof mapping.getCredentialsBannerState).toBe('function');
    expect(catalog.getCredentialsBannerState).toBe(
      mapping.getCredentialsBannerState,
    );
    expect(catalog.CredentialsBannerState).toBe(mapping.CredentialsBannerState);
  });
});

describe('@epam/ai-dial-catalog public picker surface', () => {
  it('exports CatalogPickerModal and its load status from the package root', () => {
    expect(typeof catalog.CatalogPickerModal).toBe('function');
    expect(catalog.CatalogLoadStatus.Ready).toBe('ready');
  });

  it('exports the toolbar query filter from the headless entry point and the root', () => {
    expect(typeof mapping.filterCatalogItemsByQuery).toBe('function');
    expect(catalog.filterCatalogItemsByQuery).toBe(
      mapping.filterCatalogItemsByQuery,
    );
  });
});

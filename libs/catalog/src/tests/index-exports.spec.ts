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

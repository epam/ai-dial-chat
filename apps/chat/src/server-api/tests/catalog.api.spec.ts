import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogApi } from '../api-client';
import { getCatalogItems } from '../catalog';

describe('getCatalogItems', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated CatalogApi without params', async () => {
    const mockResponse = {
      data: [
        { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' as const },
        { id: 'my-app', displayName: 'My App', type: 'application' as const },
      ],
      total: 2,
      filtered: 2,
    };
    const spy = vi
      .spyOn(catalogApi, 'listCatalogItems')
      .mockResolvedValue(mockResponse);

    const result = await getCatalogItems();

    expect(spy).toHaveBeenCalledOnce();
    expect(result).toEqual(mockResponse);
  });

  it('forwards filter params to the generated client', async () => {
    const mockResponse = {
      data: [{ id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' as const }],
      total: 2,
      filtered: 1,
    };
    const spy = vi
      .spyOn(catalogApi, 'listCatalogItems')
      .mockResolvedValue(mockResponse);

    const result = await getCatalogItems({
      modelCapabilitiesChatCompletion: true,
      modelCapabilitiesEmbeddings: false,
    });

    expect(spy).toHaveBeenCalledWith({
      modelCapabilitiesChatCompletion: true,
      modelCapabilitiesEmbeddings: false,
    });
    expect(result).toEqual(mockResponse);
  });

  it('calls listCatalogItems with undefined params when called without args', async () => {
    const spy = vi
      .spyOn(catalogApi, 'listCatalogItems')
      .mockResolvedValue({ data: [], total: 0, filtered: 0 });

    await getCatalogItems();

    expect(spy).toHaveBeenCalledWith(undefined);
  });
});

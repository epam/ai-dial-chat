import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as catalogApi from '../../server-api/catalog';
import { CatalogProvider, useCatalog } from '../CatalogContext';

vi.mock('../../server-api/catalog');

const mockItem1 = {
  id: 'gpt-4o',
  displayName: 'GPT-4o',
  type: 'model' as const,
};
const mockItem2 = {
  id: 'my-app',
  displayName: 'My App',
  type: 'application' as const,
};
const mockCatalogResponse = { data: [mockItem1, mockItem2] };

describe('CatalogContext', () => {
  const mockGetCatalogItems = vi.mocked(catalogApi.getCatalogItems);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCatalogItems.mockResolvedValue(mockCatalogResponse);
  });

  it('loads catalog items on mount', async () => {
    const { result } = renderHook(() => useCatalog(), {
      wrapper: CatalogProvider,
    });

    await waitFor(() => {
      expect(result.current.items).toEqual(mockCatalogResponse.data);
    });
    expect(mockGetCatalogItems).toHaveBeenCalledWith({
      modelCapabilitiesChatCompletion: true,
      modelCapabilitiesEmbeddings: false,
    });
  });

  it('starts with isLoading true, sets false on completion', async () => {
    let resolve: ((v: typeof mockCatalogResponse) => void) | undefined;
    mockGetCatalogItems.mockImplementationOnce(
      () =>
        new Promise<typeof mockCatalogResponse>((res) => {
          resolve = res;
        }),
    );

    const { result } = renderHook(() => useCatalog(), {
      wrapper: CatalogProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolve?.(mockCatalogResponse);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('sets selectedItemId to first item on successful load', async () => {
    const { result } = renderHook(() => useCatalog(), {
      wrapper: CatalogProvider,
    });

    await waitFor(() => {
      expect(result.current.selectedItemId).toBe(mockItem1.id);
    });
  });

  it('sets null selectedItemId when catalog is empty', async () => {
    mockGetCatalogItems.mockResolvedValueOnce({ data: [] });

    const { result } = renderHook(() => useCatalog(), {
      wrapper: CatalogProvider,
    });

    await waitFor(() => {
      expect(result.current.selectedItemId).toBeNull();
    });
  });

  it('sets error when fetch fails', async () => {
    mockGetCatalogItems.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useCatalog(), {
      wrapper: CatalogProvider,
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
    });
  });

  it('sets isLoading false even on error', async () => {
    mockGetCatalogItems.mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useCatalog(), {
      wrapper: CatalogProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('allows updating selectedItemId', async () => {
    const { result } = renderHook(() => useCatalog(), {
      wrapper: CatalogProvider,
    });

    await waitFor(() => {
      expect(result.current.items.length).toBe(2);
    });

    act(() => {
      result.current.setSelectedItemId(mockItem2.id);
    });

    expect(result.current.selectedItemId).toBe(mockItem2.id);
  });

  it('throws when useCatalog is called outside CatalogProvider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => {
      renderHook(() => useCatalog());
    }).toThrow('useCatalog must be used within a CatalogProvider');

    consoleError.mockRestore();
  });
});

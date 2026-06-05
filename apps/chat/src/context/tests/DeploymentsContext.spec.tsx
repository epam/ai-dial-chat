import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as applicationSchemasApi from '../../server-api/application-schemas';
import * as deploymentsApi from '../../server-api/deployments.api';
import { DeploymentsProvider, useDeployments } from '../DeploymentsContext';

vi.mock('../../server-api/deployments.api');
vi.mock('../../server-api/application-schemas');

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
const mockResponse = { deployments: [mockItem1, mockItem2] };
const emptySchemas = { schemas: [] };

describe('DeploymentsContext', () => {
  const mockGetDeployments = vi.mocked(deploymentsApi.getDeployments);
  const mockGetApplicationSchemas = vi.mocked(
    applicationSchemasApi.getApplicationSchemas,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDeployments.mockResolvedValue(mockResponse);
    mockGetApplicationSchemas.mockResolvedValue(emptySchemas);
  });

  it('loads items on mount and sets isLoading false on completion', async () => {
    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.items).toEqual(mockResponse.deployments);
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('sets selectedItemId to first item on successful load', async () => {
    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => {
      expect(result.current.selectedItemId).toBe(mockItem1.id);
    });
  });

  it('allows updating selectedItemId via setSelectedItemId', async () => {
    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => expect(result.current.items.length).toBe(2));

    act(() => {
      result.current.setSelectedItemId(mockItem2.id);
    });

    expect(result.current.selectedItemId).toBe(mockItem2.id);
  });

  it('throws when useDeployments is called outside DeploymentsProvider', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    expect(() => {
      renderHook(() => useDeployments());
    }).toThrow('useDeployments must be used within a DeploymentsProvider');

    consoleError.mockRestore();
  });

  it('unmount before fetch completes — no setState called', async () => {
    let resolve: ((v: typeof mockResponse) => void) | undefined;
    mockGetDeployments.mockImplementationOnce(
      () =>
        new Promise<typeof mockResponse>((res) => {
          resolve = res;
        }),
    );

    const { result, unmount } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    expect(result.current.isLoading).toBe(true);
    unmount();

    await act(async () => {
      resolve?.(mockResponse);
    });

    // State should not have updated after unmount (no error thrown)
    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it('resets selectedItemId when previously selected id is not in new items', async () => {
    mockGetDeployments.mockResolvedValueOnce({
      deployments: [mockItem2],
    });

    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => {
      expect(result.current.selectedItemId).toBe(mockItem2.id);
    });
  });

  it('sets error on fetch failure and isLoading to false', async () => {
    mockGetDeployments.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('sets null selectedItemId when deployments list is empty', async () => {
    mockGetDeployments.mockResolvedValueOnce({ deployments: [] });

    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => {
      expect(result.current.selectedItemId).toBeNull();
    });
  });

  describe('schema icon enrichment', () => {
    it('uses schema iconUrl as fallback for application deployment without own icon', async () => {
      const appWithSchema = {
        id: 'app-no-icon',
        displayName: 'App',
        type: 'application' as const,
        applicationTypeSchemaId: 'schema-abc',
      };
      mockGetDeployments.mockResolvedValueOnce({
        deployments: [appWithSchema],
      });
      mockGetApplicationSchemas.mockResolvedValueOnce({
        schemas: [
          {
            id: 'schema-abc',
            displayName: 'Quick App',
            iconUrl: 'files/bucket/icon.png',
          },
        ],
      });

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.items[0].iconUrl).toBe('files/bucket/icon.png');
      });
    });

    it('leaves iconUrl undefined when no matching schema exists', async () => {
      const appWithSchema = {
        id: 'app-no-icon',
        displayName: 'App',
        type: 'application' as const,
        applicationTypeSchemaId: 'schema-xyz',
      };
      mockGetDeployments.mockResolvedValueOnce({
        deployments: [appWithSchema],
      });
      mockGetApplicationSchemas.mockResolvedValueOnce({
        schemas: [{ id: 'schema-abc', displayName: 'Other Schema' }],
      });

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.items[0].iconUrl).toBeUndefined();
      });
    });

    it('own iconUrl always wins over matching schema iconUrl', async () => {
      const appWithOwnIcon = {
        id: 'app-own-icon',
        displayName: 'App',
        type: 'application' as const,
        iconUrl: 'own.svg',
        applicationTypeSchemaId: 'schema-abc',
      };
      mockGetDeployments.mockResolvedValueOnce({
        deployments: [appWithOwnIcon],
      });
      mockGetApplicationSchemas.mockResolvedValueOnce({
        schemas: [
          {
            id: 'schema-abc',
            displayName: 'Quick App',
            iconUrl: 'schema-icon.png',
          },
        ],
      });

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.items[0].iconUrl).toBe('own.svg');
      });
    });

    it('model deployments are never enriched with schema iconUrl', async () => {
      const model = {
        id: 'gpt-4o',
        displayName: 'GPT-4o',
        type: 'model' as const,
      };
      mockGetDeployments.mockResolvedValueOnce({ deployments: [model] });
      mockGetApplicationSchemas.mockResolvedValueOnce({
        schemas: [{ id: 'schema-abc', iconUrl: 'schema-icon.png' }],
      });

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.items[0].iconUrl).toBeUndefined();
      });
    });

    it('toolset deployments are never enriched with schema iconUrl', async () => {
      const toolset = {
        id: 'search-tool',
        displayName: 'Search Tool',
        type: 'toolset' as const,
      };
      mockGetDeployments.mockResolvedValueOnce({ deployments: [toolset] });
      mockGetApplicationSchemas.mockResolvedValueOnce({
        schemas: [{ id: 'schema-abc', iconUrl: 'schema-icon.png' }],
      });

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.items[0].iconUrl).toBeUndefined();
      });
    });

    it('schema fetch failure does not set error and deployments still load', async () => {
      mockGetApplicationSchemas.mockRejectedValueOnce(
        new Error('Schema fetch failed'),
      );

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.items).toEqual(mockResponse.deployments);
      });
    });
  });
});

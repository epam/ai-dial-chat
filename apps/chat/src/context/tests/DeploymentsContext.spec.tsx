import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeploymentSelectorI18nKeys } from '../../constants/translation-keys';
import * as applicationSchemasApi from '../../server-api/application-schemas';
import * as deploymentsApi from '../../server-api/deployments.api';
import * as toolsetsApi from '../../server-api/toolsets';
import { DeploymentsProvider, useDeployments } from '../DeploymentsContext';

const contextMocks = vi.hoisted(() => ({
  defaultDeploymentId: null as string | null,
  selectedDeploymentId: null as string | null,
  setSelectedDeployment: vi.fn(),
  showNotification: vi.fn(),
}));

vi.mock('../../server-api/deployments.api');
vi.mock('../../server-api/application-schemas');
vi.mock('../../server-api/toolsets');
vi.mock('../AppConfigContext', () => ({
  useAppConfig: () => ({
    config: {
      defaultDeploymentId: contextMocks.defaultDeploymentId,
    },
  }),
}));
vi.mock('../UserConfigContext', () => ({
  useUserConfig: () => ({
    selectedDeploymentId: contextMocks.selectedDeploymentId,
    setSelectedDeployment: contextMocks.setSelectedDeployment,
  }),
}));
vi.mock('../NotificationContext', () => ({
  useNotification: () => ({
    notifications: [],
    showNotification: contextMocks.showNotification,
    dismissNotification: vi.fn(),
  }),
}));

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
  const mockListToolsets = vi.mocked(toolsetsApi.listToolsets);

  beforeEach(() => {
    vi.clearAllMocks();
    contextMocks.defaultDeploymentId = null;
    contextMocks.selectedDeploymentId = null;
    contextMocks.setSelectedDeployment.mockResolvedValue(undefined);
    mockGetDeployments.mockResolvedValue(mockResponse);
    mockGetApplicationSchemas.mockResolvedValue(emptySchemas);
    mockListToolsets.mockResolvedValue({ data: [] });
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

  it('sorts deployments by displayName and selects first sorted item', async () => {
    const zebra = {
      id: 'zebra',
      displayName: 'Zebra',
      type: 'model' as const,
    };
    const alpha = {
      id: 'alpha',
      displayName: 'Alpha',
      type: 'model' as const,
    };
    mockGetDeployments.mockResolvedValueOnce({
      deployments: [zebra, alpha],
    });

    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => {
      expect(result.current.items.map((item) => item.id)).toEqual([
        alpha.id,
        zebra.id,
      ]);
      expect(result.current.selectedItemId).toBe(alpha.id);
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
    expect(contextMocks.setSelectedDeployment).toHaveBeenCalledWith(
      mockItem2.id,
    );
  });

  it('restoreSelectedItemId updates selectedItemId without persisting user config', async () => {
    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => expect(result.current.items.length).toBe(2));

    act(() => {
      result.current.restoreSelectedItemId(mockItem2.id);
    });

    expect(result.current.selectedItemId).toBe(mockItem2.id);
    expect(contextMocks.setSelectedDeployment).not.toHaveBeenCalled();
  });

  it('uses selected deployment from user config when it exists in the list', async () => {
    contextMocks.selectedDeploymentId = mockItem2.id;

    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => {
      expect(result.current.selectedItemId).toBe(mockItem2.id);
    });
  });

  it('uses operator default when user config selected deployment is absent', async () => {
    contextMocks.defaultDeploymentId = mockItem2.id;

    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => {
      expect(result.current.selectedItemId).toBe(mockItem2.id);
    });
  });

  it('falls back to first sorted deployment when configured ids are stale', async () => {
    contextMocks.selectedDeploymentId = 'missing-user-selection';
    contextMocks.defaultDeploymentId = 'missing-default';

    const { result } = renderHook(() => useDeployments(), {
      wrapper: DeploymentsProvider,
    });

    await waitFor(() => {
      expect(result.current.selectedItemId).toBe(mockItem1.id);
    });
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

  describe('schemas in context', () => {
    it('exposes schemas from successful fetch in context value', async () => {
      const schemaList = [
        { id: 'schema-abc', displayName: 'Quick App 2.0' },
        { id: 'schema-xyz', displayName: 'Toolset' },
      ];
      mockGetApplicationSchemas.mockResolvedValueOnce({ schemas: schemaList });

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.schemas).toEqual(schemaList);
      });
    });

    it('exposes empty schemas array when fetch fails', async () => {
      mockGetApplicationSchemas.mockRejectedValueOnce(
        new Error('Schema fetch failed'),
      );

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.schemas).toEqual([]);
      });
    });

    it('initial schemas value is an empty array', () => {
      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      expect(result.current.schemas).toEqual([]);
    });
  });

  describe('toolsets in context', () => {
    it('exposes sorted toolsets from the dedicated toolsets API', async () => {
      const zebra = {
        id: 'toolsets/b/zebra__0.0.1',
        toolset: 'toolsets/b/zebra__0.0.1',
        displayName: 'Zebra Toolset',
      };
      const alpha = {
        id: 'toolsets/b/alpha__0.0.1',
        toolset: 'toolsets/b/alpha__0.0.1',
        displayName: 'Alpha Toolset',
      };
      mockListToolsets.mockResolvedValueOnce({ data: [zebra, alpha] });

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.toolsets.map((item) => item.id)).toEqual([
          alpha.id,
          zebra.id,
        ]);
      });
    });

    it('keeps deployments available when toolsets fetch fails', async () => {
      mockListToolsets.mockRejectedValueOnce(new Error('Toolsets failed'));

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(result.current.items).toEqual(mockResponse.deployments);
        expect(result.current.toolsets).toEqual([]);
      });
    });

    it('refetchToolsets re-fetches and exposes the newly created toolset', async () => {
      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.toolsets).toEqual([]);

      const created = {
        id: 'toolsets/b/new-tool__0.0.1',
        toolset: 'toolsets/b/new-tool__0.0.1',
        displayName: 'New Tool',
      };
      mockListToolsets.mockResolvedValueOnce({ data: [created] });

      await act(async () => {
        await result.current.refetchToolsets();
      });

      expect(result.current.toolsets.map((item) => item.id)).toEqual([
        created.id,
      ]);
    });

    it('ignores a stale initial-load response that resolves after refetchToolsets', async () => {
      let resolveInitialLoad: (
        value: Awaited<ReturnType<typeof toolsetsApi.listToolsets>>,
      ) => void;
      const initialLoadPromise = new Promise<
        Awaited<ReturnType<typeof toolsetsApi.listToolsets>>
      >((resolve) => {
        resolveInitialLoad = resolve;
      });
      mockListToolsets.mockReturnValueOnce(initialLoadPromise);

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      const created = {
        id: 'toolsets/b/new-tool__0.0.1',
        toolset: 'toolsets/b/new-tool__0.0.1',
        displayName: 'New Tool',
      };
      // The initial load is still in flight when refetch is triggered.
      mockListToolsets.mockResolvedValueOnce({ data: [created] });
      await act(async () => {
        await result.current.refetchToolsets();
      });

      expect(result.current.toolsets.map((item) => item.id)).toEqual([
        created.id,
      ]);

      // The slower initial-load response arrives afterwards and must not
      // clobber the fresher refetch result.
      await act(async () => {
        resolveInitialLoad({ data: [] });
        await initialLoadPromise;
      });

      expect(result.current.toolsets.map((item) => item.id)).toEqual([
        created.id,
      ]);
    });

    it('refetchToolsets leaves toolsets unchanged when the re-fetch fails', async () => {
      const existing = {
        id: 'toolsets/b/alpha__0.0.1',
        toolset: 'toolsets/b/alpha__0.0.1',
        displayName: 'Alpha Toolset',
      };
      mockListToolsets.mockResolvedValueOnce({ data: [existing] });

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() =>
        expect(result.current.toolsets.map((item) => item.id)).toEqual([
          existing.id,
        ]),
      );

      mockListToolsets.mockRejectedValueOnce(new Error('Toolsets failed'));

      await act(async () => {
        await result.current.refetchToolsets();
      });

      expect(result.current.toolsets.map((item) => item.id)).toEqual([
        existing.id,
      ]);
      expect(contextMocks.showNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        message: DeploymentSelectorI18nKeys.RefetchToolsetsFailed,
      });
    });

    it('refetchDeployments re-fetches and exposes the updated deployment list', async () => {
      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.items).toEqual(mockResponse.deployments);

      mockGetDeployments.mockResolvedValueOnce({ deployments: [mockItem1] });

      await act(async () => {
        await result.current.refetchDeployments();
      });

      expect(result.current.items.map((item) => item.id)).toEqual([
        mockItem1.id,
      ]);
    });

    it('ignores a stale initial-load response that resolves after refetchDeployments', async () => {
      let resolveInitialLoad: (value: typeof mockResponse) => void;
      const initialLoadPromise = new Promise<typeof mockResponse>((resolve) => {
        resolveInitialLoad = resolve;
      });
      mockGetDeployments.mockReturnValueOnce(initialLoadPromise);

      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      // The initial load is still in flight when refetch is triggered.
      mockGetDeployments.mockResolvedValueOnce({ deployments: [mockItem1] });
      await act(async () => {
        await result.current.refetchDeployments();
      });

      expect(result.current.items.map((item) => item.id)).toEqual([
        mockItem1.id,
      ]);

      // The slower initial-load response arrives afterwards and must not
      // clobber the fresher refetch result.
      await act(async () => {
        resolveInitialLoad(mockResponse);
        await initialLoadPromise;
      });

      expect(result.current.items.map((item) => item.id)).toEqual([
        mockItem1.id,
      ]);
    });

    it('refetchDeployments leaves deployments unchanged when the re-fetch fails', async () => {
      const { result } = renderHook(() => useDeployments(), {
        wrapper: DeploymentsProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.items).toEqual(mockResponse.deployments);

      mockGetDeployments.mockRejectedValueOnce(new Error('Deployments failed'));

      await act(async () => {
        await result.current.refetchDeployments();
      });

      expect(result.current.items).toEqual(mockResponse.deployments);
      expect(contextMocks.showNotification).toHaveBeenCalledWith({
        variant: NotificationVariant.Error,
        message: DeploymentSelectorI18nKeys.RefetchDeploymentsFailed,
      });
    });
  });
});

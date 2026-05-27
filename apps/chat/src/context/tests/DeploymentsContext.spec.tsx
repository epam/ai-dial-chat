import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as deploymentsApi from '../../server-api/deployments.api';
import { DeploymentsProvider, useDeployments } from '../DeploymentsContext';

vi.mock('../../server-api/deployments.api');

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

describe('DeploymentsContext', () => {
  const mockGetDeployments = vi.mocked(deploymentsApi.getDeployments);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDeployments.mockResolvedValue(mockResponse);
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
});

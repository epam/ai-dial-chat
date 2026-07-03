import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUserConfig,
  updateInstalledDeployment,
  updateInstalledToolset,
} from '../../../server-api/user-config.api';
import useFavoriteApplications, {
  FavoriteEntityType,
} from '../useFavoriteApplications';

vi.mock('../../../server-api/user-config.api', () => ({
  getUserConfig: vi.fn(),
  updateInstalledDeployment: vi.fn(),
  updateInstalledToolset: vi.fn(),
}));

describe('useFavoriteApplications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserConfig).mockResolvedValue({
      version: 1,
      conversations: { pinnedIds: [] },
      toolsets: { installed: ['toolsets/b/search__0.0.1'] },
      deployments: { installed: ['gpt-4o'], selectedId: null },
    });
    vi.mocked(updateInstalledDeployment).mockResolvedValue(undefined);
    vi.mocked(updateInstalledToolset).mockResolvedValue(undefined);
  });

  it('loads installed deployments and toolsets as favorite ids', async () => {
    const { result } = renderHook(() => useFavoriteApplications());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.favoriteIds.has('gpt-4o')).toBe(true);
    expect(result.current.favoriteIds.has('toolsets/b/search__0.0.1')).toBe(
      true,
    );
  });

  it('persists toolset favorite toggles via toolset user config', async () => {
    const { result } = renderHook(() => useFavoriteApplications());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      result.current.toggleFavorite(
        'toolsets/b/salesforce',
        true,
        FavoriteEntityType.Toolset,
      );
    });

    expect(updateInstalledToolset).toHaveBeenCalledWith(
      'toolsets/b/salesforce',
      true,
    );
    expect(updateInstalledDeployment).not.toHaveBeenCalled();
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getUserConfig,
  updateInstalledDeployment,
  updateInstalledPrompt,
  updateInstalledSkill,
  updateInstalledToolset,
} from '../../server-api/user-config.api';
import {
  FavoriteApplicationsProvider,
  FavoriteEntityType,
  useFavoriteApplications,
} from '../FavoriteApplicationsContext';

vi.mock('../../server-api/user-config.api', () => ({
  getUserConfig: vi.fn(),
  updateInstalledDeployment: vi.fn(),
  updateInstalledPrompt: vi.fn(),
  updateInstalledSkill: vi.fn(),
  updateInstalledToolset: vi.fn(),
}));

describe('FavoriteApplicationsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getUserConfig).mockResolvedValue({
      version: 1,
      conversations: { pinnedIds: [] },
      toolsets: { installed: ['toolsets/b/search__0.0.1'] },
      deployments: { installed: ['gpt-4o'], selectedId: null },
      prompts: { installed: ['Work/AI/summarize'] },
      skills: { installed: ['skills/my-bucket/revenue-skill'] },
    });
    vi.mocked(updateInstalledDeployment).mockResolvedValue(undefined);
    vi.mocked(updateInstalledToolset).mockResolvedValue(undefined);
    vi.mocked(updateInstalledPrompt).mockResolvedValue(undefined);
    vi.mocked(updateInstalledSkill).mockResolvedValue(undefined);
  });

  it('throws when used outside a FavoriteApplicationsProvider', () => {
    expect(() => renderHook(() => useFavoriteApplications())).toThrowError(
      'useFavoriteApplications must be used within a FavoriteApplicationsProvider',
    );
  });

  it('loads installed deployments, toolsets, prompts, and skills as favorite ids', async () => {
    const { result } = renderHook(() => useFavoriteApplications(), {
      wrapper: FavoriteApplicationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.favoriteIds.has('gpt-4o')).toBe(true);
    expect(result.current.favoriteIds.has('toolsets/b/search__0.0.1')).toBe(
      true,
    );
    expect(result.current.favoriteIds.has('Work/AI/summarize')).toBe(true);
    expect(
      result.current.favoriteIds.has('skills/my-bucket/revenue-skill'),
    ).toBe(true);
  });

  it('persists skill favorite toggles via the skills user config section', async () => {
    const { result } = renderHook(() => useFavoriteApplications(), {
      wrapper: FavoriteApplicationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.toggleFavorite(
        'skills/my-bucket/analysis',
        true,
        FavoriteEntityType.Skill,
      );
    });

    expect(updateInstalledSkill).toHaveBeenCalledWith(
      'skills/my-bucket/analysis',
      true,
    );
    expect(updateInstalledDeployment).not.toHaveBeenCalled();
    expect(updateInstalledPrompt).not.toHaveBeenCalled();
    expect(result.current.favoriteIds.has('skills/my-bucket/analysis')).toBe(
      true,
    );
  });

  it('reverts an optimistic skill favorite when the write fails', async () => {
    vi.mocked(updateInstalledSkill).mockRejectedValueOnce(
      new Error('API error'),
    );

    const { result } = renderHook(() => useFavoriteApplications(), {
      wrapper: FavoriteApplicationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await expect(
        result.current.toggleFavorite(
          'skills/my-bucket/analysis',
          true,
          FavoriteEntityType.Skill,
        ),
      ).rejects.toThrow('API error');
    });

    expect(result.current.favoriteIds.has('skills/my-bucket/analysis')).toBe(
      false,
    );
  });

  it('persists prompt favorite toggles via the prompts user config section', async () => {
    const { result } = renderHook(() => useFavoriteApplications(), {
      wrapper: FavoriteApplicationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.toggleFavorite(
        'Work/AI/rewrite',
        true,
        FavoriteEntityType.Prompt,
      );
    });

    expect(updateInstalledPrompt).toHaveBeenCalledWith('Work/AI/rewrite', true);
    expect(updateInstalledDeployment).not.toHaveBeenCalled();
    expect(updateInstalledToolset).not.toHaveBeenCalled();
    expect(result.current.favoriteIds.has('Work/AI/rewrite')).toBe(true);
  });

  it('reverts an optimistic prompt favorite when the write fails', async () => {
    vi.mocked(updateInstalledPrompt).mockRejectedValueOnce(
      new Error('API error'),
    );

    const { result } = renderHook(() => useFavoriteApplications(), {
      wrapper: FavoriteApplicationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await expect(
        result.current.toggleFavorite(
          'Work/AI/rewrite',
          true,
          FavoriteEntityType.Prompt,
        ),
      ).rejects.toThrow('API error');
    });

    expect(result.current.favoriteIds.has('Work/AI/rewrite')).toBe(false);
  });

  it('persists toolset favorite toggles via toolset user config', async () => {
    const { result } = renderHook(() => useFavoriteApplications(), {
      wrapper: FavoriteApplicationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.toggleFavorite(
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

  it('reverts optimistic update when API call fails', async () => {
    vi.mocked(updateInstalledDeployment).mockRejectedValueOnce(
      new Error('API error'),
    );

    const { result } = renderHook(() => useFavoriteApplications(), {
      wrapper: FavoriteApplicationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    /* Call toggleFavorite and expect it to reject */
    await expect(
      act(async () => {
        await result.current.toggleFavorite('new-app', true);
      }),
    ).rejects.toThrow('API error');

    /* State should be reverted after rejection */
    expect(result.current.favoriteIds.has('new-app')).toBe(false);
  });

  it('shares favorite state across consumers mounted under the same provider', async () => {
    const { result } = renderHook(
      () => ({
        catalogConsumer: useFavoriteApplications(),
        dropdownConsumer: useFavoriteApplications(),
      }),
      { wrapper: FavoriteApplicationsProvider },
    );

    await waitFor(() =>
      expect(result.current.catalogConsumer.isLoading).toBe(false),
    );

    await act(async () => {
      await result.current.catalogConsumer.toggleFavorite('claude-3', true);
    });

    expect(result.current.dropdownConsumer.favoriteIds.has('claude-3')).toBe(
      true,
    );
  });
});

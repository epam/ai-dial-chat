import { act, renderHook, waitFor } from '@testing-library/react';
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest';
import {
  FavoriteEntityType,
  useFavoriteEntitiesState,
  type UseFavoriteEntitiesStateParams,
} from '../useFavoriteEntitiesState';

describe('useFavoriteEntitiesState', () => {
  let loadFavorites: MockedFunction<
    UseFavoriteEntitiesStateParams['loadFavorites']
  >;
  let updateFavorite: MockedFunction<
    UseFavoriteEntitiesStateParams['updateFavorite']
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    loadFavorites = vi.fn().mockResolvedValue({
      deployments: ['gpt-4o'],
      toolsets: ['toolsets/b/search__0.0.1'],
      prompts: ['Work/AI/summarize'],
      skills: ['skills/my-bucket/revenue-skill'],
    });
    updateFavorite = vi.fn().mockResolvedValue(undefined);
  });

  it('unions all four id categories on load', async () => {
    const { result } = renderHook(() =>
      useFavoriteEntitiesState({ loadFavorites, updateFavorite }),
    );

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

  it('falls back to an empty set and settles loading when loadFavorites rejects', async () => {
    loadFavorites.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() =>
      useFavoriteEntitiesState({ loadFavorites, updateFavorite }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.favoriteIds.size).toBe(0);
  });

  it('causes no post-unmount state update when unmounting before load settles', async () => {
    let resolveLoad!: (value: {
      deployments: string[];
      toolsets: string[];
      prompts: string[];
      skills: string[];
    }) => void;
    loadFavorites.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );

    const { unmount } = renderHook(() =>
      useFavoriteEntitiesState({ loadFavorites, updateFavorite }),
    );
    unmount();

    expect(() =>
      resolveLoad({
        deployments: [],
        toolsets: [],
        prompts: [],
        skills: [],
      }),
    ).not.toThrow();
  });

  it('optimistically adds the id before updateFavorite resolves', async () => {
    let resolveUpdate!: () => void;
    updateFavorite.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const { result } = renderHook(() =>
      useFavoriteEntitiesState({ loadFavorites, updateFavorite }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.toggleFavorite('id-1', true);
    });

    expect(result.current.favoriteIds.has('id-1')).toBe(true);

    resolveUpdate();
  });

  it('rolls back the optimistic add when updateFavorite rejects', async () => {
    updateFavorite.mockRejectedValueOnce(new Error('API error'));

    const { result } = renderHook(() =>
      useFavoriteEntitiesState({ loadFavorites, updateFavorite }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await expect(
        result.current.toggleFavorite('id-1', true, FavoriteEntityType.Prompt),
      ).rejects.toThrow('API error');
    });

    expect(result.current.favoriteIds.has('id-1')).toBe(false);
  });

  it('defaults entityType to Deployment when not provided', async () => {
    const { result } = renderHook(() =>
      useFavoriteEntitiesState({ loadFavorites, updateFavorite }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.toggleFavorite('new-app', true);
    });

    expect(updateFavorite).toHaveBeenCalledWith(
      'new-app',
      true,
      FavoriteEntityType.Deployment,
    );
  });

  it('result object identity is stable across unrelated re-renders', async () => {
    const { result, rerender } = renderHook(() =>
      useFavoriteEntitiesState({ loadFavorites, updateFavorite }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const before = result.current;
    rerender();

    expect(result.current).toBe(before);
  });
});

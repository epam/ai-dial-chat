import { useCallback, useEffect, useMemo, useState } from 'react';

/** Entity kind used to route a favorite toggle to the correct backend section. */
export enum FavoriteEntityType {
  Deployment = 'deployment',
  Toolset = 'toolset',
  Prompt = 'prompt',
  Skill = 'skill',
}

/** Raw favorites payload returned by `loadFavorites`. */
export interface FavoritesPayload {
  deployments: string[];
  toolsets: string[];
  prompts: string[];
  skills: string[];
}

/** Parameters for {@link useFavoriteEntitiesState}. */
export interface UseFavoriteEntitiesStateParams {
  /** Fetches the initial set of favorite ids from the server. */
  loadFavorites: () => Promise<FavoritesPayload>;
  /** Persists a single favorite toggle for the given entity type. */
  updateFavorite: (
    id: string,
    isFavorite: boolean,
    entityType: FavoriteEntityType,
  ) => Promise<void>;
}

/** Result returned by {@link useFavoriteEntitiesState}. */
export interface UseFavoriteEntitiesStateResult {
  /** Union of all installed entity ids across every category. */
  favoriteIds: ReadonlySet<string>;
  /** True until the initial load has settled. */
  isLoading: boolean;
  /** Optimistically toggles a favorite and rolls back on persistence failure. */
  toggleFavorite: (
    id: string,
    isFavorite: boolean,
    entityType?: FavoriteEntityType,
  ) => Promise<void>;
}

/**
 * Manages the set of favorited entity ids: loads on mount, applies optimistic
 * toggle with exact-inverse rollback on failure, and re-throws persistence
 * errors so callers can react. Does not import any app context or server-api.
 */
export const useFavoriteEntitiesState = ({
  loadFavorites,
  updateFavorite,
}: UseFavoriteEntitiesStateParams): UseFavoriteEntitiesStateResult => {
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cancelled = { value: false };

    const load = async () => {
      try {
        const payload = await loadFavorites();
        if (!cancelled.value) {
          setFavoriteIds(
            new Set([
              ...payload.deployments,
              ...payload.toolsets,
              ...payload.prompts,
              ...payload.skills,
            ]),
          );
        }
      } catch {
        /* silently fall back to empty set */
      } finally {
        if (!cancelled.value) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled.value = true;
    };
  }, [loadFavorites]);

  const toggleFavorite = useCallback(
    async (
      id: string,
      isFavorite: boolean,
      entityType = FavoriteEntityType.Deployment,
    ): Promise<void> => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFavorite) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });

      try {
        await updateFavorite(id, isFavorite, entityType);
      } catch (error) {
        setFavoriteIds((prev) => {
          const restored = new Set(prev);
          if (isFavorite) {
            restored.delete(id);
          } else {
            restored.add(id);
          }
          return restored;
        });
        throw error;
      }
    },
    [updateFavorite],
  );

  return useMemo(
    () => ({ favoriteIds, isLoading, toggleFavorite }),
    [favoriteIds, isLoading, toggleFavorite],
  );
};

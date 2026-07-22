import { useCallback, useEffect, useState } from 'react';
import {
  getUserConfig,
  updateInstalledDeployment,
  updateInstalledToolset,
} from '../../server-api/user-config.api';

export enum FavoriteEntityType {
  Deployment = 'deployment',
  Toolset = 'toolset',
}

interface UseFavoriteApplicationsResult {
  favoriteIds: ReadonlySet<string>;
  isLoading: boolean;
  toggleFavorite: (
    id: string,
    isFavorite: boolean,
    entityType?: FavoriteEntityType,
  ) => Promise<void>;
}

/** Loads and persists catalog application favorites via the user config API. */
const useFavoriteApplications = (): UseFavoriteApplicationsResult => {
  const [favoriteIds, setFavoriteIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const cancelled = { value: false };

    const load = async () => {
      try {
        const config = await getUserConfig();
        if (!cancelled.value) {
          setFavoriteIds(
            new Set([
              ...(config.deployments?.installed ?? []),
              ...(config.toolsets?.installed ?? []),
            ]),
          );
        }
      } catch {
        // silently fall back to empty set
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
  }, []);

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

      const updateInstalled =
        entityType === FavoriteEntityType.Toolset
          ? updateInstalledToolset
          : updateInstalledDeployment;

      try {
        await updateInstalled(id, isFavorite);
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
    [],
  );

  return { favoriteIds, isLoading, toggleFavorite };
};

export default useFavoriteApplications;

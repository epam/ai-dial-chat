import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  getUserConfig,
  updateInstalledDeployment,
  updateInstalledToolset,
} from '../server-api/user-config.api';

export enum FavoriteEntityType {
  Deployment = 'deployment',
  Toolset = 'toolset',
}

export interface FavoriteApplicationsContextType {
  favoriteIds: ReadonlySet<string>;
  isLoading: boolean;
  toggleFavorite: (
    id: string,
    isFavorite: boolean,
    entityType?: FavoriteEntityType,
  ) => Promise<void>;
}

export const FavoriteApplicationsContext = createContext<
  FavoriteApplicationsContextType | undefined
>(undefined);

/**
 * Mounted once near the app root so every consumer (the catalog and the
 * in-chat model selector) reads and mutates the same favorites state — a
 * plain per-call-site hook would leave the model selector unaware of
 * favorites toggled from the catalog until a full page reload.
 */
export const FavoriteApplicationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
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

  const contextValue = useMemo(
    () => ({ favoriteIds, isLoading, toggleFavorite }),
    [favoriteIds, isLoading, toggleFavorite],
  );

  return (
    <FavoriteApplicationsContext.Provider value={contextValue}>
      {children}
    </FavoriteApplicationsContext.Provider>
  );
};

export const useFavoriteApplications = (): FavoriteApplicationsContextType => {
  const context = useContext(FavoriteApplicationsContext);
  if (!context) {
    throw new Error(
      'useFavoriteApplications must be used within a FavoriteApplicationsProvider',
    );
  }
  return context;
};

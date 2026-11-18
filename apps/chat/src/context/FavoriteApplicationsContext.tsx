import {
  FavoriteEntityType,
  useFavoriteEntitiesState,
} from '@epam/ai-dial-chat-hooks/catalog';
import { createContext, ReactNode, useCallback, useContext } from 'react';
import {
  updateInstalledDeployment,
  updateInstalledPrompt,
  updateInstalledSkill,
  updateInstalledToolset,
} from '../server-api/user-config.api';
import { useUserConfig } from './UserConfigContext';

const INSTALL_BY_ENTITY_TYPE: Record<
  FavoriteEntityType,
  (id: string, isInstalled: boolean) => Promise<void>
> = {
  [FavoriteEntityType.Deployment]: updateInstalledDeployment,
  [FavoriteEntityType.Toolset]: updateInstalledToolset,
  [FavoriteEntityType.Prompt]: updateInstalledPrompt,
  [FavoriteEntityType.Skill]: updateInstalledSkill,
};

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
 *
 * It renders inside `UserConfigProvider`, which has already loaded the user
 * config, so the initial favorites come from that snapshot instead of a second
 * `GET user-config` on every page load.
 */
export const FavoriteApplicationsProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { loadedFavorites } = useUserConfig();
  const loadFavorites = useCallback(
    async () => loadedFavorites,
    [loadedFavorites],
  );

  const updateFavorite = useCallback(
    (id: string, isFavorite: boolean, entityType: FavoriteEntityType) =>
      INSTALL_BY_ENTITY_TYPE[entityType](id, isFavorite),
    [],
  );

  const state = useFavoriteEntitiesState({ loadFavorites, updateFavorite });

  return (
    <FavoriteApplicationsContext.Provider value={state}>
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

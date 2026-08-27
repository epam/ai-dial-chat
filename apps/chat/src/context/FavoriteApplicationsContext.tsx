import {
  FavoriteEntityType,
  useFavoriteEntitiesState,
} from '@epam/ai-dial-chat-hooks';
import { createContext, ReactNode, useCallback, useContext } from 'react';
import {
  getUserConfig,
  updateInstalledDeployment,
  updateInstalledPrompt,
  updateInstalledSkill,
  updateInstalledToolset,
} from '../server-api/user-config.api';

export { FavoriteEntityType } from '@epam/ai-dial-chat-hooks';

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

const loadFavorites = async () => {
  const config = await getUserConfig();
  return {
    deployments: config.deployments?.installed ?? [],
    toolsets: config.toolsets?.installed ?? [],
    prompts: config.prompts?.installed ?? [],
    skills: config.skills?.installed ?? [],
  };
};

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

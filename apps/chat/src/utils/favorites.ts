import { CatalogEntityType } from '@epam/ai-dial-catalog';
import { FavoriteEntityType } from '../context/FavoriteApplicationsContext';

/*
 * Each favoritable entity type writes to its own user-config section, so the
 * toggle has to know which one a catalog item belongs to. Types absent here
 * are deployments as far as the user config is concerned.
 */
const FAVORITE_ENTITY_TYPE_BY_CATALOG_TYPE: Partial<
  Record<CatalogEntityType, FavoriteEntityType>
> = {
  [CatalogEntityType.Toolset]: FavoriteEntityType.Toolset,
  [CatalogEntityType.Prompt]: FavoriteEntityType.Prompt,
};

/** Returns the user-config section a catalog item's favorite state is stored in. */
export const resolveFavoriteEntityType = (
  type?: CatalogEntityType,
): FavoriteEntityType => {
  if (type == null) return FavoriteEntityType.Deployment;
  return (
    FAVORITE_ENTITY_TYPE_BY_CATALOG_TYPE[type] ?? FavoriteEntityType.Deployment
  );
};

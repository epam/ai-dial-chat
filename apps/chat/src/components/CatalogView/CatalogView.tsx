import type { FavoriteItem } from '@epam/ai-dial-catalog';
import { Catalog } from '@epam/ai-dial-catalog';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';

// TODO: add favorites functionality and replace with actual favorites from backend
const EMPTY_FAVORITES: FavoriteItem[] = [];

const CatalogView: FC = () => {
  const { t } = useTranslation();
  const { items: deployments, isLoading } = useDeployments();

  const catalogItems = useMemo(
    () => deployments.map(mapDeploymentToCatalogItem),
    [deployments],
  );

  return (
    <Catalog
      items={catalogItems}
      isLoading={isLoading}
      favorites={EMPTY_FAVORITES}
      titles={{
        pageTitle: t(CatalogI18nKeys.PageTitle),
        createLabel: t(ButtonsI18nKeys.Create),
        favoritesTitle: t(CatalogI18nKeys.FavoritesTitle),
        browseTitle: t(ButtonsI18nKeys.Browse),
        searchPlaceholder: t(CatalogI18nKeys.SearchPlaceholder),
        noResultsTitle: (query) => t(CatalogI18nKeys.NoResultsTitle, { query }),
        sortRecentlyUpdatedLabel: t(CatalogI18nKeys.SortRecentlyUpdated),
        sortNewestLabel: t(CatalogI18nKeys.SortNewest),
        sortNameAZLabel: t(CatalogI18nKeys.SortNameAZ),
        featuredLabel: t(CatalogI18nKeys.FeaturedLabel),
        ariaLabel: t(CatalogI18nKeys.AriaLabel),
      }}
    />
  );
};

export default memo(CatalogView);

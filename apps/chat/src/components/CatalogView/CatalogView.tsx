import { Catalog, CatalogItem } from '@epam/ai-dial-catalog';
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';

const CatalogView: FC = () => {
  const { t } = useTranslation();
  const { items: deployments, isLoading } = useDeployments();

  const catalogItems = useMemo(
    () => deployments.map(mapDeploymentToCatalogItem),
    [deployments],
  );

  const favorites = useMemo(
    () => catalogItems.filter((item) => item.isUserFavorite),
    [catalogItems],
  );

  const filteredItems = useMemo(
    () => catalogItems.filter((item) => !item.isUserFavorite),
    [catalogItems],
  );
  // TODO: replace with a real API call, e.g. GET /api/catalog/{id}/about
  const fetchAboutContent = useCallback(
    (item: CatalogItem): Promise<string | undefined> =>
      console.log('Fetch about content for', item) ||
      Promise.resolve(undefined),
    [],
  );

  return (
    <Catalog
      items={filteredItems}
      isLoading={isLoading}
      favorites={favorites}
      onFetchAboutContent={fetchAboutContent}
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

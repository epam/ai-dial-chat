/* eslint-disable @typescript-eslint/no-empty-function */
import { Catalog, CatalogItem, CreateOption } from '@epam/ai-dial-catalog';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import useFavoriteApplications from '../../hooks/useFavoriteApplications/useFavoriteApplications';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';

const CatalogView: FC = () => {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const { items: deployments, isLoading: isDeploymentsLoading } =
    useDeployments();
  const {
    favoriteIds,
    isLoading: isFavoritesLoading,
    toggleFavorite,
  } = useFavoriteApplications();

  const isLoading = isDeploymentsLoading || isFavoritesLoading;

  const catalogItems = useMemo(
    () => deployments.map((d) => mapDeploymentToCatalogItem(d, favoriteIds)),
    [deployments, favoriteIds],
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
    (item: CatalogItem): Promise<string | undefined> => {
      return Promise.resolve(undefined);
    },
    [],
  );

  const onToggleFavorite = useCallback(
    (id: string, isFavorite: boolean) => {
      if (isLoading) return;
      toggleFavorite(id, isFavorite);
      const name = catalogItems.find((item) => item.id === id)?.name ?? id;

      showNotification({
        variant: isFavorite
          ? NotificationVariant.Success
          : NotificationVariant.Info,
        title: t(
          isFavorite
            ? CatalogI18nKeys.FavoriteAddedTitle
            : CatalogI18nKeys.FavoriteRemovedTitle,
        ),
        message: t(
          isFavorite
            ? CatalogI18nKeys.FavoriteAdded
            : CatalogI18nKeys.FavoriteRemoved,
          { name },
        ),
      });
    },
    [isLoading, toggleFavorite, catalogItems, showNotification, t],
  );

  const createOptions = useMemo<CreateOption[]>(
    () => [
      { label: t(CatalogI18nKeys.CreateQuickApp), onClick: () => {} },
      { label: t(CatalogI18nKeys.CreateToolset), onClick: () => {} },
    ],
    [t],
  );

  return (
    <Catalog
      items={filteredItems}
      isLoading={isLoading}
      favorites={favorites}
      createOptions={createOptions}
      onFetchAboutContent={fetchAboutContent}
      onToggleFavorite={onToggleFavorite}
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
      detailsTexts={{
        tabToolsLabel: t(CatalogI18nKeys.DetailsTabTools),
        primaryActionLabel: t(ButtonsI18nKeys.UseInChat),
        dailyLimitLabel: t(CatalogI18nKeys.DetailsDailyLimit),
        apiResourceSectionLabel: t(CatalogI18nKeys.DetailsApiResourceSection),
        apiSnippetSectionLabel: t(CatalogI18nKeys.DetailsApiSnippetSection),
        apiModelIdLabel: t(CatalogI18nKeys.DetailsApiModelId),
        apiEndpointLabel: t(CatalogI18nKeys.DetailsApiEndpoint),
        apiRequestExampleLabel: t(CatalogI18nKeys.DetailsApiRequestExample),
        apiResponseSchemaLabel: t(CatalogI18nKeys.DetailsApiResponseSchema),
        copyCodeAriaLabel: t(CatalogI18nKeys.DetailsApiCopy),
        pricingPricesSectionLabel: t(
          CatalogI18nKeys.DetailsPricingPricesSection,
        ),
        pricingLimitsSectionLabel: t(
          CatalogI18nKeys.DetailsPricingLimitsSection,
        ),
      }}
    />
  );
};

export default memo(CatalogView);

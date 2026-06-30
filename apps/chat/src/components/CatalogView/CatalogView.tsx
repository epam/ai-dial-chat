import { Catalog, CatalogItem, CreateOption } from '@epam/ai-dial-catalog';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { QUERY_VALUE_TRUE } from '../../constants/apps-editor';
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import useFavoriteApplications from '../../hooks/useFavoriteApplications/useFavoriteApplications';
import { ROUTES } from '../../types/routes';
import { mapDeploymentToCatalogItem } from '../../utils/map-deployment-to-catalog-item';

const CatalogView: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const {
    items: deployments,
    isLoading: isDeploymentsLoading,
    schemas,
  } = useDeployments();
  const {
    favoriteIds,
    isLoading: isFavoritesLoading,
    toggleFavorite,
  } = useFavoriteApplications();

  const isLoading = isDeploymentsLoading || isFavoritesLoading;

  const catalogItems = useMemo(
    () =>
      deployments.map((d) =>
        mapDeploymentToCatalogItem(d, favoriteIds, undefined, t),
      ),
    [deployments, favoriteIds, t],
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
    (_item: CatalogItem): Promise<string | undefined> => {
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

  const buildEditorUrl = useCallback((schemaId: string): string => {
    const params = new URLSearchParams({
      [AppsEditorQuery.Step]: AppsEditorStep.General,
      [AppsEditorQuery.Schema]: schemaId,
      [AppsEditorQuery.ReturnUrl]: ROUTES.Catalog,
      [AppsEditorQuery.IsCreating]: QUERY_VALUE_TRUE,
    });
    return `${ROUTES.AppsEditor}?${params.toString()}`;
  }, []);

  const createOptions = useMemo<CreateOption[]>(() => {
    const options: CreateOption[] = [];
    const quickAppSchema = schemas.find(
      (s) => s.id?.endsWith('quickapps2') || s.displayName === 'Quick app 2.0',
    );
    const toolsetSchema = schemas.find((s) => s.id?.includes('toolset'));

    if (quickAppSchema?.id) {
      const schemaId = quickAppSchema.id;
      options.push({
        label: t(CatalogI18nKeys.CreateQuickApp),
        onClick: () => navigate(buildEditorUrl(schemaId)),
      });
    }

    if (toolsetSchema?.id) {
      const schemaId = toolsetSchema.id;
      options.push({
        label: t(CatalogI18nKeys.CreateToolset),
        onClick: () => navigate(buildEditorUrl(schemaId)),
      });
    }

    return options;
  }, [schemas, navigate, t, buildEditorUrl]);

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

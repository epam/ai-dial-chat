import {
  Catalog,
  CatalogEntityType,
  CatalogItem,
  CreateOption,
} from '@epam/ai-dial-catalog';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { QUERY_VALUE_TRUE } from '../../constants/apps-editor';
import { ToolsetEditorQuery } from '../../constants/toolsets';
import {
  ButtonsI18nKeys,
  CatalogI18nKeys,
} from '../../constants/translation-keys';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import useFavoriteApplications, {
  FavoriteEntityType,
} from '../../hooks/useFavoriteApplications/useFavoriteApplications';
import { getDeploymentDetails } from '../../server-api/deployments';
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import { ROUTES } from '../../types/routes';
import {
  mapDeploymentToCatalogItem,
  mapToolsetToCatalogItem,
} from '../../utils/map-deployment-to-catalog-item';
import {
  mapDeploymentDetailsDtoToEntityDetails,
  mapEntityDetailsToCatalogDetails,
} from '../../utils/map-entity-details-to-catalog';

const CatalogView: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const {
    items: deployments,
    isLoading: isDeploymentsLoading,
    schemas,
    toolsets,
    setSelectedItemId,
  } = useDeployments();
  const {
    favoriteIds,
    isLoading: isFavoritesLoading,
    toggleFavorite,
  } = useFavoriteApplications();

  const isLoading = isDeploymentsLoading || isFavoritesLoading;

  const catalogItems = useMemo(
    () => [
      ...deployments.map((d) =>
        mapDeploymentToCatalogItem(d, favoriteIds, undefined, t),
      ),
      ...toolsets.map((toolset) =>
        mapToolsetToCatalogItem(toolset, favoriteIds),
      ),
    ],
    [deployments, favoriteIds, t, toolsets],
  );

  const favorites = useMemo(
    () => catalogItems.filter((item) => item.isUserFavorite),
    [catalogItems],
  );

  const handleFetchDetails = useCallback(async (item: CatalogItem) => {
    try {
      const dto = await getDeploymentDetails(item.id);
      const entityDetails = mapDeploymentDetailsDtoToEntityDetails(dto);
      return mapEntityDetailsToCatalogDetails(entityDetails);
    } catch {
      return undefined;
    }
  }, []);

  const onToggleFavorite = useCallback(
    (id: string, isFavorite: boolean) => {
      if (isLoading) return;
      const item = catalogItems.find((catalogItem) => catalogItem.id === id);
      toggleFavorite(
        id,
        isFavorite,
        item?.type === CatalogEntityType.Toolset
          ? FavoriteEntityType.Toolset
          : FavoriteEntityType.Deployment,
      );
      const name = item?.name ?? id;

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

  const handleUseInChat = useCallback(
    (item: CatalogItem) => {
      setSelectedItemId(item.id);
      navigate(ROUTES.Root);
    },
    [setSelectedItemId, navigate],
  );

  const isPrimaryActionVisible = useCallback(
    (item: CatalogItem) =>
      item.type === CatalogEntityType.Model ||
      item.type === CatalogEntityType.Application,
    [],
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

    if (quickAppSchema?.id) {
      const schemaId = quickAppSchema.id;
      options.push({
        label: t(CatalogI18nKeys.CreateQuickApp),
        onClick: () => navigate(buildEditorUrl(schemaId)),
      });
    }

    options.push({
      label: t(CatalogI18nKeys.CreateToolset),
      onClick: () => {
        const params = new URLSearchParams({
          [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
        });
        navigate(`${ROUTES.ToolsetEditor}?${params.toString()}`);
      },
    });

    return options;
  }, [schemas, navigate, t, buildEditorUrl]);

  return (
    <Catalog
      items={catalogItems}
      isLoading={isLoading}
      favorites={favorites}
      createOptions={createOptions}
      onFetchDetails={handleFetchDetails}
      onToggleFavorite={onToggleFavorite}
      onUseInChat={handleUseInChat}
      isPrimaryActionVisible={isPrimaryActionVisible}
      styles={{
        typography: { pageHeadingFontClassName: 'catalog-heading-text' },
      }}
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
        gridViewLabel: t(CatalogI18nKeys.GridViewLabel),
        listViewLabel: t(CatalogI18nKeys.ListViewLabel),
        ariaLabel: t(CatalogI18nKeys.AriaLabel),
        tabLabels: {
          [CatalogEntityType.Model]: t(CatalogI18nKeys.TabModels),
          [CatalogEntityType.Application]: t(CatalogI18nKeys.TabApplications),
          [CatalogEntityType.Toolset]: t(CatalogI18nKeys.TabToolsets),
        },
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

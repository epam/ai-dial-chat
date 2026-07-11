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
import { isQuickAppSchema } from '../../utils/application-schema';
import {
  mapDeploymentToCatalogItem,
  mapToolsetToCatalogItem,
} from '../../utils/map-deployment-to-catalog-item';
import {
  mapDeploymentDetailsDtoToEntityDetails,
  mapEntityDetailsToCatalogDetails,
} from '../../utils/map-entity-details-to-catalog';
import SharePopoverContainer from '../SharePopoverContainer/SharePopoverContainer';

/** Entity types shown in the catalog picker modal: models and agents only. */
const PICKER_VISIBLE_TYPES = new Set<CatalogEntityType>([
  CatalogEntityType.Model,
  CatalogEntityType.Application,
  CatalogEntityType.Agent,
]);

/** Props for `CatalogView`. */
interface Props {
  /**
   * Renders the catalog for read-only model selection (e.g. inside a picker
   * modal): hides the "Create" button and highlights the currently selected
   * deployment's card. Default: false.
   */
  isSelectorMode?: boolean;
  /** Called after a card selection commits in picker mode, so the host can close the modal. */
  onClose?: () => void;
}

const CatalogView: FC<Props> = ({ isSelectorMode = false, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const {
    items: deployments,
    selectedItemId,
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

  const quickAppSchemaId = useMemo(
    () => schemas.find((s) => isQuickAppSchema(s))?.id,
    [schemas],
  );

  const catalogItems = useMemo(
    () => [
      ...deployments.map((d) =>
        mapDeploymentToCatalogItem(
          d,
          favoriteIds,
          undefined,
          t,
          quickAppSchemaId,
        ),
      ),
      ...toolsets.map((toolset) =>
        mapToolsetToCatalogItem(toolset, favoriteIds),
      ),
    ],
    [deployments, favoriteIds, t, toolsets, quickAppSchemaId],
  );

  const visibleCatalogItems = useMemo(
    () =>
      isSelectorMode
        ? catalogItems.filter((item) => PICKER_VISIBLE_TYPES.has(item.type))
        : catalogItems,
    [catalogItems, isSelectorMode],
  );

  const favorites = useMemo(
    () => visibleCatalogItems.filter((item) => item.isUserFavorite),
    [visibleCatalogItems],
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

  // Picker mode: a card click selects it and closes the modal immediately,
  // without opening its details.
  const handleCardSelect = useCallback(
    (item: CatalogItem) => {
      setSelectedItemId(item.id);
      onClose?.();
    },
    [setSelectedItemId, onClose],
  );

  const isPrimaryActionVisible = useCallback(
    (item: CatalogItem) =>
      item.type === CatalogEntityType.Model ||
      item.type === CatalogEntityType.Application,
    [],
  );

  const buildEditorUrl = useCallback(
    ({
      schemaId,
      step,
      appId,
      isCreating,
    }: {
      schemaId: string;
      step: AppsEditorStep;
      appId?: string;
      isCreating?: boolean;
    }): string => {
      const params = new URLSearchParams({
        [AppsEditorQuery.Step]: step,
        [AppsEditorQuery.Schema]: schemaId,
        [AppsEditorQuery.ReturnUrl]: ROUTES.Catalog,
      });
      if (appId) params.set(AppsEditorQuery.AppId, appId);
      if (isCreating) params.set(AppsEditorQuery.IsCreating, QUERY_VALUE_TRUE);
      return `${ROUTES.AppsEditor}?${params.toString()}`;
    },
    [],
  );

  const handleEditApp = useCallback(
    (item: CatalogItem) => {
      if (!quickAppSchemaId) return;
      navigate(
        buildEditorUrl({
          schemaId: quickAppSchemaId,
          step: AppsEditorStep.Settings,
          appId: item.id,
        }),
      );
    },
    [quickAppSchemaId, navigate, buildEditorUrl],
  );

  const createOptions = useMemo<CreateOption[]>(() => {
    const options: CreateOption[] = [];

    if (quickAppSchemaId) {
      options.push({
        label: t(CatalogI18nKeys.CreateQuickApp),
        onClick: () =>
          navigate(
            buildEditorUrl({
              schemaId: quickAppSchemaId,
              step: AppsEditorStep.General,
              isCreating: true,
            }),
          ),
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
  }, [quickAppSchemaId, navigate, t, buildEditorUrl]);

  return (
    <Catalog
      items={visibleCatalogItems}
      isLoading={isLoading}
      favorites={favorites}
      createOptions={createOptions}
      hideCreateButton={isSelectorMode}
      hidePageTitle={isSelectorMode}
      selectedItemId={
        isSelectorMode ? (selectedItemId ?? undefined) : undefined
      }
      onCardClick={isSelectorMode ? handleCardSelect : undefined}
      onFetchDetails={handleFetchDetails}
      onToggleFavorite={onToggleFavorite}
      onUseInChat={handleUseInChat}
      onEdit={handleEditApp}
      isPrimaryActionVisible={isPrimaryActionVisible}
      shareOverlay={(item, onClose) => (
        <SharePopoverContainer item={item} onClose={onClose} />
      )}
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
        editActionLabel: t(ButtonsI18nKeys.Edit),
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

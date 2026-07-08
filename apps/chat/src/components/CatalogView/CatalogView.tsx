import {
  AccessRole,
  Catalog,
  CatalogEntityType,
  CatalogItem,
  CreateOption,
  FolderAccessData,
  PublishHistoryEntry,
} from '@epam/ai-dial-catalog';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
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
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import { ROUTES } from '../../types/routes';
import { isQuickAppSchema } from '../../utils/application-schema';
import {
  mapDeploymentToCatalogItem,
  mapToolsetToCatalogItem,
} from '../../utils/map-deployment-to-catalog-item';
import {
  MOCK_FOLDER_ACCESS,
  MOCK_PUBLISH_FOLDERS,
  MOCK_PUBLISH_HISTORY,
} from './mock-catalog-items';

const CURRENT_USER_ID = 'you';

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

  const [publishHistory, setPublishHistory] =
    useState<Record<string, PublishHistoryEntry[]>>(MOCK_PUBLISH_HISTORY);

  const [folderAccessOverrides, setFolderAccessOverrides] = useState<
    Record<string, FolderAccessData>
  >({});

  const favorites = useMemo(
    () => catalogItems.filter((item) => item.isUserFavorite),
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

  // TODO: temporary mock wiring for the Publish flow — replace with a real
  // publish endpoint (history lookup, folder tree, write-access check) once
  // one exists.
  const getPublishHistory = useCallback(
    (item: CatalogItem) => publishHistory[item.id] ?? [],
    [publishHistory],
  );

  const hasPublishWriteAccess = useCallback(
    (folderPath: string[]) => !folderPath.includes('Production'),
    [],
  );

  const getFolderAccess = useCallback(
    (folderPath: string[]): FolderAccessData => {
      const key = folderPath.join('/');
      return (
        folderAccessOverrides[key] ??
        MOCK_FOLDER_ACCESS[key] ?? {
          people: [
            { id: CURRENT_USER_ID, name: 'Yuliia M.', role: AccessRole.Owner },
          ],
          groups: [],
        }
      );
    },
    [folderAccessOverrides],
  );

  const handleAddFolderAccessMember = useCallback(
    (folderPath: string[], name: string, role: AccessRole) => {
      const key = folderPath.join('/');
      setFolderAccessOverrides((prev) => {
        const current = getFolderAccess(folderPath);
        return {
          ...prev,
          [key]: {
            ...current,
            people: [
              ...current.people,
              { id: `member-${Date.now()}`, name, role },
            ],
          },
        };
      });
    },
    [getFolderAccess],
  );

  const handlePublish = useCallback(
    async (_item: CatalogItem, _folderPath: string[]) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    },
    [],
  );

  const handlePublishSuccess = useCallback(
    (item: CatalogItem, folderPath: string[]) => {
      setPublishHistory((prev) => {
        const existing = prev[item.id] ?? [];
        const newEntry: PublishHistoryEntry = {
          version: item.version,
          publishedAt: Date.now(),
          publishedBy: CURRENT_USER_ID,
          folderPath,
        };
        const withoutSameVersionInFolder = existing.filter(
          (entry) =>
            entry.version !== item.version ||
            entry.folderPath.join('/') !== folderPath.join('/'),
        );
        return {
          ...prev,
          [item.id]: [newEntry, ...withoutSameVersionInFolder],
        };
      });

      showNotification({
        variant: NotificationVariant.Success,
        title: t(CatalogI18nKeys.PublishSuccessTitle),
        message: t(CatalogI18nKeys.PublishSuccess, {
          name: item.name,
          folder: folderPath[folderPath.length - 1],
        }),
      });
    },
    [showNotification, t],
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
    const quickAppSchema = schemas.find((s) => isQuickAppSchema(s));

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
      onFetchAboutContent={fetchAboutContent}
      onToggleFavorite={onToggleFavorite}
      onUseInChat={handleUseInChat}
      isPrimaryActionVisible={isPrimaryActionVisible}
      getPublishHistory={getPublishHistory}
      publishFolderItems={MOCK_PUBLISH_FOLDERS}
      hasPublishWriteAccess={hasPublishWriteAccess}
      onPublish={handlePublish}
      onPublishSuccess={handlePublishSuccess}
      getFolderAccess={getFolderAccess}
      currentUserId={CURRENT_USER_ID}
      onAddFolderAccessMember={handleAddFolderAccessMember}
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

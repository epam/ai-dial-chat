import {
  Catalog,
  CatalogEntityType,
  CatalogItem,
  CatalogItemDetailsFetchResult,
  CatalogViewMode,
  CreateOption,
  CredentialsLevel,
  CredentialStatus,
} from '@epam/ai-dial-catalog';
import { OverlayFeature } from '@epam/ai-dial-chat-shared';
import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { ToolsetLogoutBodyDto } from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QUERY_VALUE_TRUE } from '../../constants/apps-editor';
import { ToolsetEditorQuery } from '../../constants/toolsets';
import {
  ApiI18nKeys,
  AuthI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  DialFileManagerI18nKeys,
  FavoritesI18nKeys,
  NavigationI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import {
  FavoriteEntityType,
  useFavoriteApplications,
} from '../../context/FavoriteApplicationsContext';
import { useNotification } from '../../context/NotificationContext';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import {
  ToolsetLoginOutcomeType,
  useToolsetLogin,
} from '../../hooks/toolsets/useToolsetLogin';
import { useCatalogSortFilterPreference } from '../../hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference';
import { useUiFeature } from '../../hooks/useUiFeature';
import { deleteApplication } from '../../server-api/applications';
import { getDeploymentLimits } from '../../server-api/deployment-limits';
import { getDeploymentDetails } from '../../server-api/deployments';
import { getPublishRules } from '../../server-api/publish-rules.api';
import { publishCatalogEntity } from '../../server-api/publish.api';
import { deleteToolset, logoutToolset } from '../../server-api/toolsets';
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import { CatalogQuery } from '../../types/catalog';
import { ROUTES } from '../../types/routes';
import type { ToolsetAuthTypes } from '../../types/toolsets';
import { ToolsetCredentialsLevel } from '../../types/toolsets';
import { isQuickAppSchema } from '../../utils/application-schema';
import { mapDeploymentLimitsDtoToCatalogLimits } from '../../utils/map-deployment-limits-to-catalog';
import {
  mapDeploymentToCatalogItem,
  mapToolsetToCatalogItem,
} from '../../utils/map-deployment-to-catalog-item';
import {
  mapDeploymentDetailsDtoToEntityDetails,
  mapEntityDetailsToCatalogDetails,
  mapToolsetCredentials,
} from '../../utils/map-entity-details-to-catalog';
import { getAccessRulesLabels, toPublishEntityType } from '../../utils/publish';
import ConnectPopoverContainer from '../ConnectPopoverContainer/ConnectPopoverContainer';
import SharePopoverContainer from '../SharePopoverContainer/SharePopoverContainer';

/** Entity types shown in the catalog picker modal: models and agents only. */
const PICKER_VISIBLE_TYPES = new Set<CatalogEntityType>([
  CatalogEntityType.Model,
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
  const [searchParams, setSearchParams] = useSearchParams();
  const itemIdParam = searchParams.get(CatalogQuery.ItemId) ?? undefined;
  const initialDetailsItemId = itemIdParam;

  /*
   * `itemId` is a one-shot signal from a shared-invitation redirect (see
   * SharedInvitationPage) meant to open the details panel once. Clearing it
   * here keeps it from lingering in the URL, so a later navigation back to
   * the same deployment's shared link isn't ignored just because the param
   * still equals a value Catalog already consumed once before.
   */
  useEffect(() => {
    if (!itemIdParam) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(CatalogQuery.ItemId);
        return next;
      },
      { replace: true },
    );
  }, [itemIdParam, setSearchParams]);

  const { showNotification } = useNotification();
  const { user } = useUser();
  const isAdmin = user?.isAdmin ?? false;
  const { config } = useAppConfig();
  const dialCoreExternalUrl = config.dialCoreExternalUrl;
  const {
    items: deployments,
    selectedItemId,
    isLoading: isDeploymentsLoading,
    schemas,
    toolsets,
    setSelectedItemId,
    refetchToolsets,
    refetchDeployments,
  } = useDeployments();
  const {
    favoriteIds,
    isLoading: isFavoritesLoading,
    toggleFavorite,
  } = useFavoriteApplications();
  const {
    sortKey,
    setSortKey,
    filterTopics: persistedFilterTopics,
    setFilterTopics,
    isMyAppsActive,
    setIsMyAppsActive,
  } = useCatalogSortFilterPreference();

  const isLoading = isDeploymentsLoading || isFavoritesLoading;

  const quickAppSchemaId = useMemo(
    () => schemas.find((s) => isQuickAppSchema(s))?.id,
    [schemas],
  );

  const isCatalogEnabled = useUiFeature(OverlayFeature.Catalog);
  const isCatalogTableViewEnabled = useUiFeature(
    OverlayFeature.CatalogTableView,
  );
  const isCatalogHideMyAppsEnabled = useUiFeature(
    OverlayFeature.CatalogHideMyApps,
  );
  const isToolsetsEnabled = useUiFeature(OverlayFeature.Toolsets);
  const isCustomApplicationsEnabled = useUiFeature(
    OverlayFeature.CustomApplications,
  );
  const isHideCustomAppCreationEnabled = useUiFeature(
    OverlayFeature.HideCustomAppCreation,
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
      ...(isToolsetsEnabled
        ? toolsets.map((toolset) =>
            mapToolsetToCatalogItem(toolset, favoriteIds, isAdmin, t),
          )
        : []),
    ],
    [
      deployments,
      favoriteIds,
      t,
      toolsets,
      quickAppSchemaId,
      isAdmin,
      isToolsetsEnabled,
    ],
  );

  const visibleCatalogItems = useMemo(() => {
    let result = isSelectorMode
      ? catalogItems.filter((item) => PICKER_VISIBLE_TYPES.has(item.type))
      : catalogItems;
    if (isCatalogHideMyAppsEnabled) {
      result = result.filter((item) => !item.isMyApp);
    }
    return result;
  }, [catalogItems, isSelectorMode, isCatalogHideMyAppsEnabled]);

  const reconciledFilterTopics = useMemo(() => {
    const availableTopics = new Set(
      visibleCatalogItems.flatMap((item) => item.topics),
    );
    return new Set(
      Array.from(persistedFilterTopics).filter((topic) =>
        availableTopics.has(topic),
      ),
    );
  }, [visibleCatalogItems, persistedFilterTopics]);

  const {
    folderItems: publishFolderItems,
    expandedPaths: publishExpandedPaths,
    loadingPaths: publishLoadingPaths,
    onExpandedPathsChange: onPublishExpandedPathsChange,
    onCreatePublishFolder,
    hasPublishWriteAccess,
  } = usePublishFolders();

  const favorites = useMemo(
    () => visibleCatalogItems.filter((item) => item.isUserFavorite),
    [visibleCatalogItems],
  );

  const handleFetchDetails = useCallback(
    async (
      item: CatalogItem,
    ): Promise<CatalogItemDetailsFetchResult | undefined> => {
      try {
        const limitsPromise =
          item.type === CatalogEntityType.Model
            ? getDeploymentLimits(item.id).catch(() => undefined)
            : Promise.resolve(undefined);
        const [dto, limitsDto] = await Promise.all([
          getDeploymentDetails(item.id),
          limitsPromise,
        ]);
        const entityDetails = mapDeploymentDetailsDtoToEntityDetails(dto);
        return {
          ...mapEntityDetailsToCatalogDetails(entityDetails),
          limits: mapDeploymentLimitsDtoToCatalogLimits(limitsDto, t),
          credentials:
            entityDetails.type === 'TOOLSET'
              ? mapToolsetCredentials(item.id, entityDetails.data, isAdmin)
              : undefined,
        };
      } catch {
        return undefined;
      }
    },
    [isAdmin, t],
  );

  const getLevelStatus = useCallback(
    (
      item: CatalogItem,
      level: CredentialsLevel,
    ): CredentialStatus | undefined =>
      level === CredentialsLevel.User
        ? item.credentials?.userStatus
        : item.credentials?.globalStatus,
    [],
  );

  const showLoginSuccess = useCallback(
    (item: CatalogItem, level: CredentialsLevel) => {
      const isAdminAndPublic = isAdmin && !!item.credentials?.isPublic;
      const messageKey =
        level === CredentialsLevel.User
          ? CatalogI18nKeys.CredentialsLoginSuccessUser
          : isAdminAndPublic
            ? CatalogI18nKeys.CredentialsLoginSuccessOrg
            : CatalogI18nKeys.CredentialsLoginSuccessGlobal;
      showNotification({
        variant: NotificationVariant.Success,
        title: t(CatalogI18nKeys.CredentialsLoginSuccessTitle),
        message: t(messageKey, { name: item.name, version: item.version }),
      });
    },
    [isAdmin, showNotification, t],
  );

  const showLogoutSuccess = useCallback(
    (item: CatalogItem, level: CredentialsLevel) => {
      const isAdminAndPublic = isAdmin && !!item.credentials?.isPublic;
      const messageKey =
        level === CredentialsLevel.User
          ? CatalogI18nKeys.CredentialsLogoutSuccessUser
          : isAdminAndPublic
            ? CatalogI18nKeys.CredentialsLogoutSuccessOrg
            : CatalogI18nKeys.CredentialsLogoutSuccessGlobal;
      showNotification({
        variant: NotificationVariant.Success,
        title: t(CatalogI18nKeys.CredentialsLogoutSuccessTitle),
        message: t(messageKey, { name: item.name, version: item.version }),
      });
    },
    [isAdmin, showNotification, t],
  );

  const { login: loginToolsetShared } = useToolsetLogin();

  const handleLogin = useCallback(
    async (
      item: CatalogItem,
      params: { level: CredentialsLevel; apiKey?: string },
    ) => {
      const authenticationType = item.credentials?.authenticationType;
      const credentialsLevel =
        params.level === CredentialsLevel.User
          ? ToolsetCredentialsLevel.User
          : ToolsetCredentialsLevel.Global;
      const toolset = toolsets.find((t) => t.id === item.id);

      const outcome = await loginToolsetShared({
        toolsetId: item.id,
        credentialsLevel,
        authenticationType: authenticationType as unknown as ToolsetAuthTypes,
        apiKey: params.apiKey,
        oauthSettings: {
          clientId: toolset?.authSettings?.clientId,
          authorizationEndpoint: toolset?.authSettings?.authorizationEndpoint,
          scopes: toolset?.authSettings?.scopesSupported,
          codeChallenge: toolset?.authSettings?.codeChallenge,
          codeChallengeMethod: toolset?.authSettings?.codeChallengeMethod,
        },
        isCurrentlyFailed:
          getLevelStatus(item, params.level) === CredentialStatus.Failed,
      });

      switch (outcome.type) {
        case ToolsetLoginOutcomeType.Success:
          showLoginSuccess(item, params.level);
          await refetchToolsets();
          return;
        case ToolsetLoginOutcomeType.PopupBlocked:
          showNotification({
            variant: NotificationVariant.Error,
            message: t(ToolsetEditorI18nKeys.ErrorPopupBlocked),
          });
          return;
        case ToolsetLoginOutcomeType.Failure:
          showNotification({
            variant: NotificationVariant.Error,
            message: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
          });
          return;
        case ToolsetLoginOutcomeType.Cancelled:
          // Silent — matches the pre-refactor behavior for a genuine cancel.
          return;
      }
    },
    [
      toolsets,
      showNotification,
      t,
      getLevelStatus,
      showLoginSuccess,
      refetchToolsets,
      loginToolsetShared,
    ],
  );

  const handleLogout = useCallback(
    async (item: CatalogItem, params: { level: CredentialsLevel }) => {
      const credentialsLevel =
        params.level === CredentialsLevel.User
          ? ToolsetCredentialsLevel.User
          : ToolsetCredentialsLevel.Global;
      try {
        const body: ToolsetLogoutBodyDto = {
          url: item.id,
          credentialsLevel:
            credentialsLevel as ToolsetLogoutBodyDto['credentialsLevel'],
          authenticationType: item.credentials
            ?.authenticationType as ToolsetLogoutBodyDto['authenticationType'],
        };
        await logoutToolset(item.id, body);
        showLogoutSuccess(item, params.level);
        await refetchToolsets();
      } catch {
        showNotification({
          variant: NotificationVariant.Error,
          message: t(ToolsetEditorI18nKeys.ErrorLogoutFailed),
        });
      }
    },
    [showNotification, t, showLogoutSuccess, refetchToolsets],
  );

  const onToggleFavorite = useCallback(
    async (id: string, isFavorite: boolean) => {
      if (isLoading) return;
      const item = catalogItems.find((catalogItem) => catalogItem.id === id);
      const name = item?.name ?? id;

      try {
        await toggleFavorite(
          id,
          isFavorite,
          item?.type === CatalogEntityType.Toolset
            ? FavoriteEntityType.Toolset
            : FavoriteEntityType.Deployment,
        );

        showNotification({
          variant: isFavorite
            ? NotificationVariant.Success
            : NotificationVariant.Info,
          title: t(
            isFavorite
              ? FavoritesI18nKeys.AddedTitle
              : FavoritesI18nKeys.RemovedTitle,
          ),
          message: t(
            isFavorite ? FavoritesI18nKeys.Added : FavoritesI18nKeys.Removed,
            { name },
          ),
        });
      } catch {
        showNotification({
          variant: NotificationVariant.Error,
          title: t(
            isFavorite
              ? FavoritesI18nKeys.AddFailedTitle
              : FavoritesI18nKeys.RemoveFailedTitle,
          ),
          message: t(
            isFavorite
              ? FavoritesI18nKeys.AddFailed
              : FavoritesI18nKeys.RemoveFailed,
            { name },
          ),
        });
      }
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

  /* Picker mode: a card click selects it and closes the modal immediately,
   * without opening its details. */
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
      item.type === CatalogEntityType.Agent,
    [],
  );

  const isPublishVisible = useCallback(
    (item: CatalogItem) =>
      Boolean(item.isMyApp) && toPublishEntityType(item.type) != null,
    [],
  );

  const isConnectVisible = useCallback(
    (item: CatalogItem) => {
      if (!dialCoreExternalUrl) return false;
      if (item.type === CatalogEntityType.Toolset) return true;
      return item.type === CatalogEntityType.Agent && item.supportsMcp === true;
    },
    [dialCoreExternalUrl],
  );

  const isApplicationsSharingEnabled = useUiFeature(
    OverlayFeature.ApplicationsSharing,
  );
  const isToolsetsSharingEnabled = useUiFeature(OverlayFeature.ToolsetsSharing);
  const isShareVisible = useCallback(
    (item: CatalogItem) =>
      item.type === CatalogEntityType.Toolset
        ? isToolsetsSharingEnabled
        : isApplicationsSharingEnabled,
    [isApplicationsSharingEnabled, isToolsetsSharingEnabled],
  );

  /*
   * Publish history is never fetched: the backend endpoint returns 503 for
   * DIAL Core (see GH issue #7897), the same outage already worked around
   * in `PublishConversationPanelContainer`. Restore the
   * `getCatalogPublishHistory` call here once the backend is fixed.
   */
  const getPublishHistory = useCallback(async () => [], []);

  const handlePublish = useCallback(
    async (
      item: CatalogItem,
      folderPath: string[],
      rules: PublicationRule[],
    ) => {
      const entityType = toPublishEntityType(item.type);
      if (!entityType) {
        throw new Error(`Entity type "${item.type}" is not publishable`);
      }
      await publishCatalogEntity(entityType, item.id, {
        folderPath: folderPath.join('/'),
        version: item.version,
        rules,
      });
    },
    [],
  );

  const handleFetchExistingRules = useCallback(
    (folderPath: string[]) => getPublishRules(folderPath.join('/')),
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

  const handlePublishSuccess = useCallback(
    (item: CatalogItem, folderPath: string[]) => {
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

  const handleEdit = useCallback(
    (item: CatalogItem) => {
      if (item.type === CatalogEntityType.Toolset) {
        const params = new URLSearchParams({
          [ToolsetEditorQuery.Id]: item.id,
          [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
        });
        navigate(`${ROUTES.ToolsetEditor}?${params.toString()}`);
        return;
      }

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

  const handleDelete = useCallback(
    async (item: CatalogItem) => {
      try {
        if (item.type === CatalogEntityType.Toolset) {
          await deleteToolset(item.id);
          await refetchToolsets();
        } else {
          await deleteApplication(item.id);
          await refetchDeployments();
        }

        showNotification({
          variant: NotificationVariant.Success,
          title: t(CatalogI18nKeys.DetailsDeleteSuccessTitle),
          message: t(CatalogI18nKeys.DetailsDeleteSuccess, { name: item.name }),
        });
      } catch (err) {
        showNotification({
          variant: NotificationVariant.Error,
          message: t(CatalogI18nKeys.DetailsDeleteError),
        });
        throw err;
      }
    },
    [refetchToolsets, refetchDeployments, showNotification, t],
  );

  const createOptions = useMemo<CreateOption[]>(() => {
    const options: CreateOption[] = [];

    if (
      quickAppSchemaId &&
      isCustomApplicationsEnabled &&
      !isHideCustomAppCreationEnabled
    ) {
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

    if (isToolsetsEnabled) {
      options.push({
        label: t(CatalogI18nKeys.CreateToolset),
        onClick: () => {
          const params = new URLSearchParams({
            [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
          });
          navigate(`${ROUTES.ToolsetEditor}?${params.toString()}`);
        },
      });
    }

    return options;
  }, [
    quickAppSchemaId,
    navigate,
    t,
    buildEditorUrl,
    isCustomApplicationsEnabled,
    isHideCustomAppCreationEnabled,
    isToolsetsEnabled,
  ]);

  if (!isCatalogEnabled && !isSelectorMode) {
    return null;
  }

  return (
    <Catalog
      items={visibleCatalogItems}
      isLoading={isLoading}
      favorites={favorites}
      createOptions={createOptions}
      hideCreateButton={isSelectorMode}
      hidePageTitle={isSelectorMode}
      initialViewMode={
        isCatalogTableViewEnabled ? CatalogViewMode.List : undefined
      }
      selectedItemId={
        isSelectorMode ? (selectedItemId ?? undefined) : undefined
      }
      initialDetailsItemId={initialDetailsItemId}
      onCardClick={isSelectorMode ? handleCardSelect : undefined}
      sortKey={isSelectorMode ? undefined : sortKey}
      onSortChange={isSelectorMode ? undefined : setSortKey}
      filterTopics={isSelectorMode ? undefined : reconciledFilterTopics}
      onFilterTopicsChange={isSelectorMode ? undefined : setFilterTopics}
      isMyAppsActive={isSelectorMode ? undefined : isMyAppsActive}
      onMyAppsActiveChange={isSelectorMode ? undefined : setIsMyAppsActive}
      onFetchDetails={handleFetchDetails}
      onToggleFavorite={onToggleFavorite}
      onUseInChat={handleUseInChat}
      onLogin={handleLogin}
      onLogout={handleLogout}
      onEdit={handleEdit}
      onDelete={handleDelete}
      isPrimaryActionVisible={isPrimaryActionVisible}
      isPublishVisible={isPublishVisible}
      getPublishHistory={getPublishHistory}
      publishFolderItems={publishFolderItems}
      publishExpandedPaths={publishExpandedPaths}
      onPublishExpandedPathsChange={onPublishExpandedPathsChange}
      publishLoadingPaths={publishLoadingPaths}
      onCreatePublishFolder={onCreatePublishFolder}
      hasPublishWriteAccess={hasPublishWriteAccess}
      onPublish={handlePublish}
      onPublishSuccess={handlePublishSuccess}
      ruleSourceOptions={config.publicationFilterSources}
      onFetchExistingRules={handleFetchExistingRules}
      publishLabels={{
        searchPlaceholder: t(CatalogI18nKeys.PublishFolderSearchPlaceholder),
        folderEmptyStateLabel: t(CatalogI18nKeys.PublishFolderEmptyState, {
          query: '{query}',
        }),
        historyLoadingLabel: t(CatalogI18nKeys.PublishHistoryLoading),
        historyErrorLabel: t(CatalogI18nKeys.PublishHistoryError),
        accessRulesLabels: getAccessRulesLabels(t),
      }}
      shareOverlay={(item, onClose) => (
        <SharePopoverContainer item={item} onClose={onClose} />
      )}
      isShareVisible={isShareVisible}
      isConnectVisible={isConnectVisible}
      connectOverlay={(item, onClose) => (
        <ConnectPopoverContainer item={item} onClose={onClose} />
      )}
      styles={{
        typography: { pageHeadingFontClassName: 'dial-h1-text' },
      }}
      titles={{
        pageTitle: t(NavigationI18nKeys.Catalog),
        createLabel: t(ButtonsI18nKeys.Create),
        favoritesTitle: t(FavoritesI18nKeys.Title),
        browseTitle: t(ButtonsI18nKeys.Browse),
        searchPlaceholder: t(CatalogI18nKeys.SearchPlaceholder),
        noResultsTitle: (query) => t(CatalogI18nKeys.NoResultsTitle, { query }),
        sortRecentlyUpdatedLabel: t(CatalogI18nKeys.SortRecentlyUpdated),
        sortNewestLabel: t(CatalogI18nKeys.SortNewest),
        sortNameAZLabel: t(CatalogI18nKeys.SortNameAZ),
        featuredLabel: t(CatalogI18nKeys.FeaturedLabel),
        gridViewLabel: t(CatalogI18nKeys.GridViewLabel),
        listViewLabel: t(CatalogI18nKeys.ListViewLabel),
        ariaLabel: t(NavigationI18nKeys.Catalog),
        tabLabels: {
          [CatalogEntityType.Model]: t(CatalogI18nKeys.TabModels),
          [CatalogEntityType.Agent]: t(CatalogI18nKeys.TabApplications),
          [CatalogEntityType.Toolset]: t(CatalogI18nKeys.TabToolsets),
        },
      }}
      detailsTexts={{
        tabToolsLabel: t(CatalogI18nKeys.DetailsTabTools),
        tabLimitsLabel: t(CatalogI18nKeys.DetailsTabLimits),
        primaryActionLabel: t(ButtonsI18nKeys.UseInChat),
        editActionLabel: t(ButtonsI18nKeys.Edit),
        deleteActionLabel: t(ButtonsI18nKeys.Delete),
        deletingStatusLabel: t(DialFileManagerI18nKeys.DeletingLabel),
        dailyLimitLabel: t(CatalogI18nKeys.DetailsDailyLimit),
        apiResourceSectionLabel: t(CatalogI18nKeys.DetailsApiResourceSection),
        apiSnippetSectionLabel: t(CatalogI18nKeys.DetailsApiSnippetSection),
        apiModelIdLabel: t(CatalogI18nKeys.DetailsApiModelId),
        apiEndpointLabel: t(ApiI18nKeys.EndpointLabel),
        apiRequestExampleLabel: t(CatalogI18nKeys.DetailsApiRequestExample),
        apiResponseSchemaLabel: t(CatalogI18nKeys.DetailsApiResponseSchema),
        copyCodeAriaLabel: t(ButtonsI18nKeys.Copy),
        pricingPricesSectionLabel: t(
          CatalogI18nKeys.DetailsPricingPricesSection,
        ),
        pricingLimitsSectionLabel: t(
          CatalogI18nKeys.DetailsPricingLimitsSection,
        ),
        loginActionLabel: t(ButtonsI18nKeys.LogIn),
        logoutActionLabel: t(ButtonsI18nKeys.LogOut),
        loginWithMyCredsActionLabel: t(
          CatalogI18nKeys.CredentialsLoginWithMyCredsLabel,
        ),
        manageCredentialsActionLabel: t(CatalogI18nKeys.CredentialsManageLabel),
        myCredentialsSectionLabel: t(CatalogI18nKeys.CredentialsMySectionLabel),
        organizationCredentialsSectionLabel: t(
          CatalogI18nKeys.CredentialsOrgSectionLabel,
        ),
        credentialsSignedInLabel: t(CatalogI18nKeys.CredentialsSignedInLabel),
        credentialsSignedOutLabel: t(CatalogI18nKeys.CredentialsSignedOutLabel),
        logoutConfirmMessage: t(AuthI18nKeys.LogOutConfirmDescription),
        apiKeyFieldLabel: t(ApiI18nKeys.ApiKey),
        apiKeyFieldHint: (header) =>
          t(CatalogI18nKeys.CredentialsApiKeyFieldHint, { header }),
        credentialsBadgeLoggedOutLabel: t(
          CatalogI18nKeys.CredentialsBadgeLoggedOut,
        ),
        connectLabel: t(ButtonsI18nKeys.Connect),
      }}
    />
  );
};

export default memo(CatalogView);

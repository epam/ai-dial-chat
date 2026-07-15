import {
  Catalog,
  CatalogEntityType,
  CatalogItem,
  CatalogItemDetailsFetchResult,
  CredentialsLevel,
  CredentialStatus,
  CreateOption,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';
import { NotificationVariant } from '@epam/ai-dial-ui-kit';
import type {
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/chat-api-client';
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QUERY_VALUE_TRUE } from '../../constants/apps-editor';
import { ToolsetEditorQuery } from '../../constants/toolsets';
import {
  ApiI18nKeys,
  AuthI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  FavoritesI18nKeys,
  NavigationI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import useFavoriteApplications, {
  FavoriteEntityType,
} from '../../hooks/useFavoriteApplications/useFavoriteApplications';
import { deleteApplication } from '../../server-api/applications';
import { getDeploymentDetails } from '../../server-api/deployments';
import {
  getCatalogPublishHistory,
  publishCatalogEntity,
} from '../../server-api/publish.api';
import { discardSharedCatalogItem } from '../../server-api/share.api';
import {
  deleteToolset,
  loginToolset,
  logoutToolset,
} from '../../server-api/toolsets';
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import { CatalogQuery } from '../../types/catalog';
import { ROUTES } from '../../types/routes';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  WithLogin,
} from '../../types/toolsets';
import { isQuickAppSchema } from '../../utils/application-schema';
import {
  mapDeploymentToCatalogItem,
  mapToolsetToCatalogItem,
} from '../../utils/map-deployment-to-catalog-item';
import {
  mapDeploymentDetailsDtoToEntityDetails,
  mapEntityDetailsToCatalogDetails,
  mapToolsetCredentials,
} from '../../utils/map-entity-details-to-catalog';
import {
  mapPublishHistoryEntryDto,
  toPublishEntityType,
} from '../../utils/publish';
import { initiateOAuthLogin } from '../../utils/toolsets';
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
  const [searchParams] = useSearchParams();
  const initialDetailsItemId =
    searchParams.get(CatalogQuery.ItemId) ?? undefined;
  const { showNotification } = useNotification();
  const { user } = useUser();
  const isAdmin = user?.isAdmin ?? false;
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
        mapToolsetToCatalogItem(toolset, favoriteIds, isAdmin, t),
      ),
    ],
    [deployments, favoriteIds, t, toolsets, quickAppSchemaId, isAdmin],
  );

  const visibleCatalogItems = useMemo(
    () =>
      isSelectorMode
        ? catalogItems.filter((item) => PICKER_VISIBLE_TYPES.has(item.type))
        : catalogItems,
    [catalogItems, isSelectorMode],
  );

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
        const dto = await getDeploymentDetails(item.id);
        const entityDetails = mapDeploymentDetailsDtoToEntityDetails(dto);
        return {
          ...mapEntityDetailsToCatalogDetails(entityDetails),
          credentials:
            entityDetails.type === 'TOOLSET'
              ? mapToolsetCredentials(item.id, entityDetails.data, isAdmin)
              : undefined,
        };
      } catch {
        return undefined;
      }
    },
    [isAdmin],
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

      if (authenticationType === ToolsetAuthenticationType.OAuth) {
        const toolset = toolsets.find((t) => t.id === item.id);
        const started = initiateOAuthLogin(
          {
            authenticationType: ToolsetAuthTypes.OAuth,
            withLogin: WithLogin.WithConfig,
            isLoggedIn: false,
            clientId: toolset?.authSettings?.clientId,
            authorizationEndpoint: toolset?.authSettings?.authorizationEndpoint,
            scopes: toolset?.authSettings?.scopesSupported,
            codeChallenge: toolset?.authSettings?.codeChallenge,
            codeChallengeMethod: toolset?.authSettings?.codeChallengeMethod,
          },
          item.id,
          credentialsLevel,
        );
        if (!started) {
          showNotification({
            variant: NotificationVariant.Error,
            message: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
          });
        }
        return;
      }

      try {
        if (getLevelStatus(item, params.level) === CredentialStatus.Failed) {
          await logoutToolset(item.id, {
            url: item.id,
            credentialsLevel:
              credentialsLevel as ToolsetLogoutBodyDto['credentialsLevel'],
            authenticationType:
              authenticationType as ToolsetLogoutBodyDto['authenticationType'],
          });
        }
        const body: ToolsetLoginBodyDto = {
          url: item.id,
          credentialsLevel:
            credentialsLevel as ToolsetLoginBodyDto['credentialsLevel'],
          authenticationType:
            authenticationType as ToolsetLoginBodyDto['authenticationType'],
          apiKey: params.apiKey?.trim(),
        };
        await loginToolset(item.id, body);
        showLoginSuccess(item, params.level);
        await refetchToolsets();
      } catch {
        showNotification({
          variant: NotificationVariant.Error,
          message: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
        });
      }
    },
    [
      toolsets,
      showNotification,
      t,
      getLevelStatus,
      showLoginSuccess,
      refetchToolsets,
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
            ? FavoritesI18nKeys.AddedTitle
            : FavoritesI18nKeys.RemovedTitle,
        ),
        message: t(
          isFavorite ? FavoritesI18nKeys.Added : FavoritesI18nKeys.Removed,
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
      item.type === CatalogEntityType.Toolset ||
      item.type === CatalogEntityType.Application,
    [],
  );

  const isPublishVisible = useCallback(
    (item: CatalogItem) =>
      Boolean(item.isMyApp) && toPublishEntityType(item.type) != null,
    [],
  );

  const getPublishHistory = useCallback(async (item: CatalogItem) => {
    const entityType = toPublishEntityType(item.type);
    if (!entityType) {
      return [];
    }
    const entries = await getCatalogPublishHistory(entityType, item.id);
    return entries.map(mapPublishHistoryEntryDto);
  }, []);

  const handlePublish = useCallback(
    async (item: CatalogItem, folderPath: string[]) => {
      const entityType = toPublishEntityType(item.type);
      if (!entityType) {
        throw new Error(`Entity type "${item.type}" is not publishable`);
      }
      await publishCatalogEntity(entityType, item.id, {
        folderPath: folderPath.join('/'),
        version: item.version,
      });
    },
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

  const handleUnshare = useCallback(
    async (item: CatalogItem) => {
      try {
        await discardSharedCatalogItem(item.id);
      } catch (err) {
        showNotification({
          variant: NotificationVariant.Error,
          title: t(CatalogI18nKeys.DetailsUnshareErrorTitle),
          message: t(CatalogI18nKeys.DetailsUnshareError, { name: item.name }),
        });
        throw err;
      }

      try {
        if (item.type === CatalogEntityType.Toolset) {
          await refetchToolsets();
        } else {
          await refetchDeployments();
        }
      } catch {
        /*
         * The discard mutation has already succeeded. A refresh failure must
         * not turn that irreversible success into an actionable retry error;
         * the deployments context retains its own fetch error state.
         */
      }

      if (item.id === selectedItemId) {
        setSelectedItemId(null);
      }

      showNotification({
        variant: NotificationVariant.Success,
        title: t(CatalogI18nKeys.DetailsUnshareSuccessTitle),
        message: t(CatalogI18nKeys.DetailsUnshareSuccess, {
          name: item.name,
        }),
      });
    },
    [
      refetchToolsets,
      refetchDeployments,
      selectedItemId,
      setSelectedItemId,
      showNotification,
      t,
    ],
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
      initialDetailsItemId={initialDetailsItemId}
      onCardClick={isSelectorMode ? handleCardSelect : undefined}
      onFetchDetails={handleFetchDetails}
      onToggleFavorite={onToggleFavorite}
      onUseInChat={handleUseInChat}
      onLogin={handleLogin}
      onLogout={handleLogout}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onUnshare={handleUnshare}
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
      publishTexts={{
        searchPlaceholder: t(CatalogI18nKeys.PublishFolderSearchPlaceholder),
        folderEmptyStateText: t(CatalogI18nKeys.PublishFolderEmptyState, {
          query: '{query}',
        }),
        historyLoadingText: t(CatalogI18nKeys.PublishHistoryLoading),
        historyErrorText: t(CatalogI18nKeys.PublishHistoryError),
      }}
      shareOverlay={(item, onClose) => (
        <SharePopoverContainer item={item} onClose={onClose} />
      )}
      styles={{
        typography: { pageHeadingFontClassName: 'catalog-heading-text' },
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
          [CatalogEntityType.Application]: t(CatalogI18nKeys.TabApplications),
          [CatalogEntityType.Toolset]: t(CatalogI18nKeys.TabToolsets),
        },
      }}
      detailsTexts={{
        tabToolsLabel: t(CatalogI18nKeys.DetailsTabTools),
        primaryActionLabel: t(ButtonsI18nKeys.UseInChat),
        editActionLabel: t(ButtonsI18nKeys.Edit),
        deleteActionLabel: t(ButtonsI18nKeys.Delete),
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
        unshareLabel: t(CatalogI18nKeys.DetailsUnshareLabel),
        unshareConfirmTitle: t(CatalogI18nKeys.DetailsUnshareConfirmTitle),
        unshareConfirmMessage: (name) =>
          t(CatalogI18nKeys.DetailsUnshareConfirmMessage, { name }),
        cancelLabel: t(ButtonsI18nKeys.Cancel),
      }}
    />
  );
};

export default memo(CatalogView);

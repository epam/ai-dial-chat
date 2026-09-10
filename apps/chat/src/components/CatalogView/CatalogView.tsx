import {
  Catalog,
  CredentialsLevel,
  ToolsetAuthenticationType,
} from '@epam/ai-dial-catalog';
import {
  type CatalogEditNavigationLabels,
  type CatalogEditNavigationUrls,
  findDeploymentByIdOrReference,
  type ToolsetCredentialsLabels,
  useCatalogEditNavigation,
  useCatalogToolsetCredentials,
} from '@epam/ai-dial-chat-hooks';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import type { FC } from 'react';
import { memo, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
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
  PublishI18nKeys,
  SkillArchiveImportI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useFavoriteApplications } from '../../context/FavoriteApplicationsContext';
import { useNotification } from '../../context/NotificationContext';
import { usePrompts } from '../../context/PromptsContext';
import { useSkills } from '../../context/SkillsContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { usePublishErrorNotification } from '../../hooks/publish/usePublishErrorNotification';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import { useSkillArchiveImport } from '../../hooks/skills/useSkillArchiveImport';
import { useCatalogActiveTabPreference } from '../../hooks/useCatalogActiveTabPreference/useCatalogActiveTabPreference';
import { useCatalogItemActions } from '../../hooks/useCatalogItemActions/useCatalogItemActions';
import { useCatalogItems } from '../../hooks/useCatalogItems/useCatalogItems';
import { useCatalogPublishing } from '../../hooks/useCatalogPublishing/useCatalogPublishing';
import { useCatalogSharing } from '../../hooks/useCatalogSharing/useCatalogSharing';
import { useCatalogSortFilterPreference } from '../../hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { useUiFeature } from '../../hooks/useUiFeature';
import { deleteApplication } from '../../server-api/applications';
import { deletePrompt } from '../../server-api/prompts.api';
import { deleteSkill } from '../../server-api/skills.api';
import {
  deleteToolset,
  getToolset,
  loginToolset,
  logoutToolset,
} from '../../server-api/toolsets';
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import { CatalogQuery } from '../../types/catalog';
import { EditorQuery } from '../../types/editor-query';
import { EntityOperation } from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { getCatalogSearchPlaceholder } from '../../utils/catalog';
import { resolveCatalogItemEntity } from '../../utils/entity-notification';
import { getAccessRulesLabels } from '../../utils/publish';
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
  /**
   * Called with the selected deployment's id when a card is picked in
   * selector mode, instead of committing the pick to `DeploymentsContext`.
   * Omit to keep the default behavior (updates the chat input's own
   * selected deployment via `setSelectedItemId`).
   */
  onSelect?: (id: string) => void;
  /**
   * Entity types shown while `isSelectorMode` is true. Defaults to
   * `PICKER_VISIBLE_TYPES` (models and agents only), matching the existing
   * model/agent picker.
   */
  visibleTypes?: Set<CatalogEntityType>;
  /**
   * Renders the Browse cards and list across the full width of the content
   * area instead of the centered 1180 px column, so wide screens show no
   * empty gutters beside the cards. Default: false.
   */
  isFullWidth?: boolean;
}

const CatalogView: FC<Props> = ({
  isSelectorMode = false,
  onClose,
  onSelect,
  visibleTypes = PICKER_VISIBLE_TYPES,
  isFullWidth = false,
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
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

  const { showSuccessNotification, showErrorNotification, showNotification } =
    useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
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

  const isCatalogEnabled = useUiFeature(OverlayFeature.Catalog);
  const isCatalogHideMyAppsEnabled = useUiFeature(
    OverlayFeature.CatalogHideMyApps,
  );
  const isToolsetsEnabled = useUiFeature(OverlayFeature.Toolsets);
  const isCustomAppsEnabled = useUiFeature(OverlayFeature.CustomApps);
  const isSchemaAppsEnabled = useUiFeature(OverlayFeature.SchemaApps);
  const isHideCustomAppCreationEnabled = useUiFeature(
    OverlayFeature.HideCustomAppCreation,
  );
  const isPromptsEnabled = useUiFeature(OverlayFeature.Prompts);
  const isSkillsEnabled = useUiFeature(OverlayFeature.Skills);

  const {
    prompts,
    sharedWithMe: sharedPrompts,
    publicPrompts,
    refetchPrompts,
  } = usePrompts();

  const {
    skills,
    sharedWithMe: sharedSkills = [],
    publicSkills,
    isLoading: isSkillsLoading,
    error: skillsError,
    refetchSkills,
  } = useSkills();

  const {
    fileInputRef: skillArchiveFileInputRef,
    statusMessage: skillArchiveStatusMessage,
    triggerFilePicker: triggerSkillArchivePicker,
    handleFileChange: handleSkillArchiveFileChange,
  } = useSkillArchiveImport();

  const isLoading =
    isDeploymentsLoading || isFavoritesLoading || isSkillsLoading;

  /*
   * A skill-listing failure is reported once and leaves the rest of the
   * catalog usable — deployments, toolsets, and prompts load independently.
   */
  useEffect(() => {
    if (skillsError == null) return;
    showErrorNotification({ message: t(CatalogI18nKeys.SkillsLoadError) });
  }, [skillsError, showErrorNotification, t]);

  const {
    quickAppSchemaId,
    quickAppDeploymentIds,
    catalogItems,
    visibleCatalogItems,
    reconciledFilterTopics,
    availableTabIds,
    favorites,
    onFetchDetails,
    onLoadContentFile,
    onLoadSkillDetailsFile,
  } = useCatalogItems({
    schemas,
    deployments,
    favoriteIds,
    t,
    language,
    toolsets,
    isAdmin,
    dialCoreExternalUrl,
    isToolsetsEnabled,
    isCustomAppsEnabled,
    isPromptsEnabled,
    isSkillsEnabled,
    prompts,
    sharedPrompts,
    publicPrompts,
    skills,
    sharedSkills,
    publicSkills,
    isSelectorMode,
    visibleTypes,
    isCatalogHideMyAppsEnabled,
    persistedFilterTopics,
  });

  const { activeTab, setActiveTab } =
    useCatalogActiveTabPreference(availableTabIds);

  /*
   * Names only the entity types actually on offer, so a picker restricted to
   * agents doesn't advertise models and toolsets the user cannot reach.
   */
  const searchPlaceholder = useMemo(
    () => getCatalogSearchPlaceholder(availableTabIds, t),
    [availableTabIds, t],
  );

  const {
    folderItems: publishFolderItems,
    expandedPaths: publishExpandedPaths,
    loadingPaths: publishLoadingPaths,
    onExpandedPathsChange: onPublishExpandedPathsChange,
    onCreatePublishFolder,
    rememberPublishFolder,
    hasPublishWriteAccess,
  } = usePublishFolders();

  const showPublishError = usePublishErrorNotification();

  const toolsetCredentialsLabels: ToolsetCredentialsLabels = useMemo(() => {
    const formatMessage =
      (key: CatalogI18nKeys) =>
      ({ name, version }: { name: string; version?: string }) =>
        t(key, { name, version });
    return {
      loginSuccessTitle: t(CatalogI18nKeys.CredentialsLoginSuccessTitle),
      loginSuccess: {
        user: formatMessage(CatalogI18nKeys.CredentialsLoginSuccessUser),
        org: formatMessage(CatalogI18nKeys.CredentialsLoginSuccessOrg),
        global: formatMessage(CatalogI18nKeys.CredentialsLoginSuccessGlobal),
      },
      apiKeyAddedSuccessTitle: t(
        CatalogI18nKeys.CredentialsApiKeyAddedSuccessTitle,
      ),
      apiKeyAddedSuccess: {
        user: formatMessage(CatalogI18nKeys.CredentialsApiKeyAddedSuccessUser),
        org: formatMessage(CatalogI18nKeys.CredentialsApiKeyAddedSuccessOrg),
        global: formatMessage(
          CatalogI18nKeys.CredentialsApiKeyAddedSuccessGlobal,
        ),
      },
      logoutSuccessTitle: t(CatalogI18nKeys.CredentialsLogoutSuccessTitle),
      logoutSuccess: {
        user: formatMessage(CatalogI18nKeys.CredentialsLogoutSuccessUser),
        org: formatMessage(CatalogI18nKeys.CredentialsLogoutSuccessOrg),
        global: formatMessage(CatalogI18nKeys.CredentialsLogoutSuccessGlobal),
      },
      apiKeyDeletedSuccessTitle: t(
        CatalogI18nKeys.CredentialsApiKeyDeletedSuccessTitle,
      ),
      apiKeyDeletedSuccess: {
        user: formatMessage(
          CatalogI18nKeys.CredentialsApiKeyDeletedSuccessUser,
        ),
        org: formatMessage(CatalogI18nKeys.CredentialsApiKeyDeletedSuccessOrg),
        global: formatMessage(
          CatalogI18nKeys.CredentialsApiKeyDeletedSuccessGlobal,
        ),
      },
      popupBlockedError: t(ToolsetEditorI18nKeys.ErrorPopupBlocked),
      loginFailedError: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
      logoutFailedError: t(ToolsetEditorI18nKeys.ErrorLogoutFailed),
    };
  }, [t]);

  const { handleLogin, handleLogout } = useCatalogToolsetCredentials({
    isAdmin,
    toolsets,
    refetchToolsets,
    callbackPath: ROUTES.ToolsetSignIn,
    loginToolset,
    logoutToolset,
    getToolset,
    labels: toolsetCredentialsLabels,
    onNotify: showNotification,
  });

  const {
    onToggleFavorite,
    handleUseInChat,
    handleCardSelect,
    handleDownload,
    isDownloadVisible,
    isPrimaryActionVisible,
    renderContentFilePreview,
  } = useCatalogItemActions({
    t,
    navigate,
    onClose,
    onSelect,
    setSelectedItemId,
    catalogItems,
    isLoading,
    toggleFavorite,
    showSuccessNotification,
    showErrorNotification,
    notifyOperationSuccess,
    onLoadSkillDetailsFile,
  });

  const {
    getPublishHistory,
    handlePublish,
    handleUnpublish,
    handlePublishSuccess,
    handlePublishError,
    handleFetchExistingRules,
    isPublishVisible,
    isUnpublishVisible,
  } = useCatalogPublishing({
    deployments,
    rememberPublishFolder,
    notifyOperationSuccess,
    showPublishError,
    isAdmin,
    hasPublishWriteAccess,
  });

  const {
    isShareVisible,
    isUnshareVisible,
    isRevokeShareVisible,
    handleUnshare,
    handleRevokeShare,
    handleFetchRecipientsCount,
  } = useCatalogSharing({
    t,
    refetchToolsets,
    refetchSkills,
    refetchPrompts,
    refetchDeployments,
    selectedItemId,
    setSelectedItemId,
    showSuccessNotification,
    showErrorNotification,
  });

  const catalogEditUrls: CatalogEditNavigationUrls = useMemo(() => {
    const buildUrl = (route: string, params: Record<string, string>) =>
      `${route}?${new URLSearchParams(params).toString()}`;
    return {
      buildPromptEditUrl: (id) =>
        buildUrl(ROUTES.PromptEditor, {
          [EditorQuery.Id]: id,
          [EditorQuery.ReturnUrl]: ROUTES.Catalog,
        }),
      buildPromptCreateUrl: () =>
        buildUrl(ROUTES.PromptEditor, {
          [EditorQuery.ReturnUrl]: ROUTES.Catalog,
        }),
      buildSkillEditUrl: (id) =>
        buildUrl(ROUTES.SkillEditor, {
          [EditorQuery.Id]: id,
          [EditorQuery.ReturnUrl]: ROUTES.Catalog,
        }),
      buildSkillCreateUrl: () =>
        buildUrl(ROUTES.SkillEditor, {
          [EditorQuery.ReturnUrl]: ROUTES.Catalog,
        }),
      buildToolsetEditUrl: (id) =>
        buildUrl(ROUTES.ToolsetEditor, {
          [ToolsetEditorQuery.Id]: id,
          [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
        }),
      buildToolsetCreateUrl: () =>
        buildUrl(ROUTES.ToolsetEditor, {
          [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
        }),
      buildCustomAppEditUrl: (id) =>
        buildUrl(ROUTES.CustomAppEditor, {
          [ToolsetEditorQuery.Id]: id,
          [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
        }),
      buildCustomAppCreateUrl: () =>
        buildUrl(ROUTES.CustomAppEditor, {
          [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
        }),
      buildQuickAppEditUrl: (schemaId, appId) =>
        buildUrl(ROUTES.AppsEditor, {
          [AppsEditorQuery.Step]: AppsEditorStep.Settings,
          [AppsEditorQuery.Schema]: schemaId,
          [AppsEditorQuery.ReturnUrl]: ROUTES.Catalog,
          [AppsEditorQuery.AppId]: appId,
        }),
      buildQuickAppCreateUrl: (schemaId) =>
        buildUrl(ROUTES.AppsEditor, {
          [AppsEditorQuery.Step]: AppsEditorStep.General,
          [AppsEditorQuery.Schema]: schemaId,
          [AppsEditorQuery.ReturnUrl]: ROUTES.Catalog,
          [AppsEditorQuery.IsCreating]: QUERY_VALUE_TRUE,
        }),
    };
  }, []);

  const catalogEditNavigationLabels: CatalogEditNavigationLabels = useMemo(
    () => ({
      createQuickApp: t(CatalogI18nKeys.CreateQuickApp),
      createToolset: t(CatalogI18nKeys.CreateToolset),
      createCustomApp: t(CatalogI18nKeys.CreateCustomApp),
      createSkill: t(CatalogI18nKeys.CreateSkill),
      createSkillWriteInstructions: t(
        CatalogI18nKeys.CreateSkillWriteInstructions,
      ),
      createSkillUpload: t(CatalogI18nKeys.CreateSkillUpload),
      createPrompt: t(CatalogI18nKeys.CreatePrompt),
      deleteError: t(CatalogI18nKeys.DetailsDeleteError),
    }),
    [t],
  );

  const { handleEdit, handleDelete, createOptions } = useCatalogEditNavigation({
    deployments,
    isCustomAppsEnabled,
    isSchemaAppsEnabled,
    isHideCustomAppCreationEnabled,
    isToolsetsEnabled,
    isPromptsEnabled,
    quickAppSchemaId,
    urls: catalogEditUrls,
    onNavigate: navigate,
    deletePrompt,
    deleteToolset,
    deleteSkill,
    deleteApplication,
    refetchPrompts,
    refetchToolsets,
    refetchSkills,
    refetchDeployments,
    onDeleteSuccess: (item) =>
      notifyOperationSuccess(
        resolveCatalogItemEntity(
          item.type,
          findDeploymentByIdOrReference(deployments, item.id),
        ),
        EntityOperation.Deleted,
        { name: item.name },
      ),
    labels: catalogEditNavigationLabels,
    onNotify: showErrorNotification,
    triggerSkillArchivePicker,
  });

  if (!isCatalogEnabled && !isSelectorMode) {
    return null;
  }

  return (
    <>
      <input
        ref={skillArchiveFileInputRef}
        type="file"
        accept=".zip,.md"
        className="sr-only"
        tabIndex={-1}
        aria-label={t(SkillArchiveImportI18nKeys.FileInputAriaLabel)}
        onChange={handleSkillArchiveFileChange}
      />
      <span role="status" aria-live="polite" className="sr-only">
        {skillArchiveStatusMessage}
      </span>
      <Catalog
        items={visibleCatalogItems}
        isLoading={isLoading}
        favorites={favorites}
        createOptions={createOptions}
        hideCreateButton={isSelectorMode}
        hidePageTitle={isSelectorMode}
        isFullWidth={isFullWidth}
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
        activeTab={isSelectorMode ? undefined : activeTab}
        onActiveTabChange={isSelectorMode ? undefined : setActiveTab}
        onFetchDetails={onFetchDetails}
        onToggleFavorite={onToggleFavorite}
        onUseInChat={handleUseInChat}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onEdit={handleEdit}
        onDownload={handleDownload}
        isDownloadVisible={isDownloadVisible}
        onLoadContentFile={onLoadContentFile}
        renderContentFilePreview={renderContentFilePreview}
        onDelete={handleDelete}
        onUnshare={handleUnshare}
        isUnshareVisible={isUnshareVisible}
        onRevokeShare={handleRevokeShare}
        onFetchRecipientsCount={handleFetchRecipientsCount}
        isRevokeShareVisible={isRevokeShareVisible}
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
        onUnpublish={handleUnpublish}
        isUnpublishVisible={isUnpublishVisible}
        onPublishError={handlePublishError}
        ruleSourceOptions={config.publicationFilterSources}
        onFetchExistingRules={handleFetchExistingRules}
        publishLabels={{
          searchPlaceholder: t(CatalogI18nKeys.PublishFolderSearchPlaceholder),
          cancelCreatingFolderLabel: t(ButtonsI18nKeys.Cancel),
          folderEmptyStateLabel: t(CatalogI18nKeys.PublishFolderEmptyState, {
            query: '{query}',
          }),
          historyLoadingLabel: t(CatalogI18nKeys.PublishHistoryLoading),
          historyErrorLabel: t(CatalogI18nKeys.PublishHistoryError),
          submitError: t(PublishI18nKeys.SubmitErrorCallout),
          accessRulesLabels: getAccessRulesLabels(t),
        }}
        shareOverlay={(item, onClose) => (
          <SharePopoverContainer
            item={item}
            isQuickApp={quickAppDeploymentIds.has(item.id)}
            onClose={onClose}
          />
        )}
        isShareVisible={isShareVisible}
        styles={{
          typography: { pageHeadingFontClassName: 'dial-h1-text' },
        }}
        titles={{
          pageTitle: t(NavigationI18nKeys.Catalog),
          createLabel: t(ButtonsI18nKeys.Create),
          favoritesTitle: t(FavoritesI18nKeys.Title),
          browseTitle: t(ButtonsI18nKeys.Browse),
          searchPlaceholder,
          noResultsTitle: (query) =>
            t(CatalogI18nKeys.NoResultsTitle, { query }),
          sortRecentlyUpdatedLabel: t(CatalogI18nKeys.SortRecentlyUpdated),
          sortNewestLabel: t(CatalogI18nKeys.SortNewest),
          sortNameAZLabel: t(CatalogI18nKeys.SortNameAZ),
          featuredLabel: t(CatalogI18nKeys.FeaturedLabel),
          gridViewLabel: t(CatalogI18nKeys.GridViewLabel),
          listViewLabel: t(CatalogI18nKeys.ListViewLabel),
          viewToggleLabel: t(CatalogI18nKeys.ViewToggleLabel),
          ariaLabel: t(NavigationI18nKeys.Catalog),
          tabLabels: {
            [CatalogEntityType.Model]: t(CatalogI18nKeys.TabModels),
            [CatalogEntityType.Agent]: t(CatalogI18nKeys.TabApplications),
            [CatalogEntityType.Toolset]: t(CatalogI18nKeys.TabToolsets),
            [CatalogEntityType.Prompt]: t(CatalogI18nKeys.TabPrompts),
            [CatalogEntityType.Skill]: t(CatalogI18nKeys.TabSkills),
          },
        }}
        detailsTexts={{
          tabToolsLabel: t(CatalogI18nKeys.DetailsTabTools),
          tabContentLabel: t(CatalogI18nKeys.DetailsTabContent),
          tabLimitsLabel: t(CatalogI18nKeys.DetailsTabLimits),
          contentFileSelectorAriaLabel: t(
            CatalogI18nKeys.DetailsContentFileSelectorAriaLabel,
          ),
          contentFileCountLabel: (count: number) =>
            t(CatalogI18nKeys.DetailsContentFileCount, { count }),
          contentFileLoadingLabel: t(CatalogI18nKeys.DetailsContentFileLoading),
          contentFileErrorLabel: t(CatalogI18nKeys.DetailsContentFileError),
          contentFileUnsupportedLabel: t(
            CatalogI18nKeys.DetailsContentFileUnsupported,
          ),
          primaryActionLabel: t(ButtonsI18nKeys.UseInChat),
          editActionLabel: t(ButtonsI18nKeys.Edit),
          downloadActionLabel: t(ButtonsI18nKeys.Download),
          downloadingStatusLabel: t(CatalogI18nKeys.DetailsDownloadingStatus),
          deleteActionLabel: t(ButtonsI18nKeys.Delete),
          deletingStatusLabel: t(DialFileManagerI18nKeys.DeletingLabel),
          apiResourceSectionLabel: t(CatalogI18nKeys.DetailsApiResourceSection),
          apiSnippetSectionLabel: t(CatalogI18nKeys.DetailsApiSnippetSection),
          apiModelIdLabel: t(CatalogI18nKeys.DetailsApiModelId),
          apiEndpointLabel: t(ApiI18nKeys.EndpointLabel),
          apiEndpointSectionLabel: t(ApiI18nKeys.EndpointLabel),
          apiRequestExampleLabel: t(CatalogI18nKeys.DetailsApiRequestExample),
          apiResponseSchemaLabel: t(CatalogI18nKeys.DetailsApiResponseSchema),
          copyCodeAriaLabel: t(ButtonsI18nKeys.Copy),
          copiedCodeStatusLabel: t(ButtonsI18nKeys.Copied),
          pricingPricesSectionLabel: t(
            CatalogI18nKeys.DetailsPricingPricesSection,
          ),
          pricingLimitsSectionLabel: t(
            CatalogI18nKeys.DetailsPricingLimitsSection,
          ),
          loginActionLabel: t(ButtonsI18nKeys.LogIn),
          logoutActionLabel: t(ButtonsI18nKeys.LogOut),
          manageCredentialsActionLabel: (authenticationType) =>
            authenticationType === ToolsetAuthenticationType.ApiKey
              ? t(CatalogI18nKeys.CredentialsManageApiKeysLabel)
              : t(CatalogI18nKeys.CredentialsManageLabel),
          credentialsSignedInLabel: t(CatalogI18nKeys.CredentialsSignedInLabel),
          credentialsSignedOutLabel: t(
            CatalogI18nKeys.CredentialsSignedOutLabel,
          ),
          logoutConfirmMessage: t(AuthI18nKeys.LogOutConfirmDescription),
          deleteApiKeyConfirmMessage: (level) =>
            level === CredentialsLevel.Global
              ? t(CatalogI18nKeys.CredentialsDeleteApiKeyConfirmMessageOrg)
              : t(
                  CatalogI18nKeys.CredentialsDeleteApiKeyConfirmMessagePersonal,
                ),
          apiKeyFieldLabel: t(ApiI18nKeys.ApiKey),
          apiKeyRequiredErrorMessage: t(
            CatalogI18nKeys.CredentialsApiKeyRequiredErrorMessage,
          ),
          apiKeyActionLabel: t(ApiI18nKeys.ApiKey),
          changeApiKeyActionLabel: t(
            CatalogI18nKeys.CredentialsChangeApiKeyActionLabel,
          ),
          personalApiKeyPanelTitle: t(
            CatalogI18nKeys.CredentialsPersonalApiKeyPanelTitle,
          ),
          personalApiKeyAddedMessage: t(
            CatalogI18nKeys.CredentialsPersonalApiKeyAddedMessage,
          ),
          apiKeyConfiguredMessage: t(
            CatalogI18nKeys.CredentialsApiKeyConfiguredMessage,
          ),
          addApiKeyActionLabel: t(ButtonsI18nKeys.Add),
          addingApiKeyStatusLabel: t(
            CatalogI18nKeys.CredentialsAddingApiKeyStatusLabel,
          ),
          apiKeyAddedLabel: (when) =>
            t(CatalogI18nKeys.CredentialsApiKeyAddedLabel, { when }),
          orgFallbackBannerTitle: (authenticationType) =>
            authenticationType === ToolsetAuthenticationType.ApiKey
              ? t(CatalogI18nKeys.CredentialsOrgFallbackBannerTitleApiKey)
              : t(CatalogI18nKeys.CredentialsOrgFallbackBannerTitleCredentials),
          orgFallbackBannerDescription: (authenticationType) =>
            authenticationType === ToolsetAuthenticationType.ApiKey
              ? t(CatalogI18nKeys.CredentialsOrgFallbackBannerDescriptionApiKey)
              : t(
                  CatalogI18nKeys.CredentialsOrgFallbackBannerDescriptionCredentials,
                ),
          orgCredentialsActiveBannerTitle: (authenticationType) =>
            authenticationType === ToolsetAuthenticationType.ApiKey
              ? t(CatalogI18nKeys.CredentialsOrgActiveBannerTitleApiKey)
              : t(CatalogI18nKeys.CredentialsOrgActiveBannerTitleCredentials),
          personalCredentialsActiveBannerTitle: (authenticationType) =>
            authenticationType === ToolsetAuthenticationType.ApiKey
              ? t(CatalogI18nKeys.CredentialsPersonalActiveBannerTitleApiKey)
              : t(
                  CatalogI18nKeys.CredentialsPersonalActiveBannerTitleCredentials,
                ),
          credentialsManagementTitle: (authenticationType) =>
            authenticationType === ToolsetAuthenticationType.ApiKey
              ? t(CatalogI18nKeys.CredentialsManagementTitleApiKey)
              : t(CatalogI18nKeys.CredentialsManagementTitleCredentials),
          credentialsManagementDescription: (authenticationType) =>
            authenticationType === ToolsetAuthenticationType.ApiKey
              ? t(CatalogI18nKeys.CredentialsManagementDescriptionApiKey)
              : t(CatalogI18nKeys.CredentialsManagementDescriptionCredentials),
          personalCredentialsLabel: t(CatalogI18nKeys.CredentialsPersonalLabel),
          personalCredentialsDescription: t(
            CatalogI18nKeys.CredentialsPersonalDescription,
          ),
          organizationCredentialsLabel: t(
            CatalogI18nKeys.CredentialsOrganizationLabel,
          ),
          organizationCredentialsDescription: t(
            CatalogI18nKeys.CredentialsOrganizationDescription,
          ),
          credentialsBadgeLoggedOutLabel: t(
            CatalogI18nKeys.CredentialsBadgeLoggedOut,
          ),
          tabConnectLabel: t(ButtonsI18nKeys.Connect),
          manageActionLabel: t(ButtonsI18nKeys.Manage),
          deleteConfirmTitle: t(CatalogI18nKeys.DetailsDeleteConfirmTitle),
          deleteConfirmMessage: (name) =>
            t(CatalogI18nKeys.DetailsDeleteConfirmMessage, { name }),
          deleteConfirmConsequences: [
            t(CatalogI18nKeys.DetailsDeleteConsequenceSharedConfigurations),
            t(CatalogI18nKeys.DetailsDeleteConsequenceUsersLoseAccess),
            t(CatalogI18nKeys.DetailsDeleteConsequenceCannotBeUndone),
          ],
          unshareLabel: t(ButtonsI18nKeys.RemoveFromMyList),
          unshareConfirmTitle: t(CatalogI18nKeys.DetailsUnshareConfirmTitle),
          unshareConfirmMessage: (name) =>
            t(CatalogI18nKeys.DetailsUnshareConfirmMessage, { name }),
          unshareConfirmConsequences: [
            t(CatalogI18nKeys.DetailsUnshareConsequenceYouLoseAccess),
            t(CatalogI18nKeys.DetailsUnshareConsequenceOthersKeepAccess),
            t(CatalogI18nKeys.DetailsUnshareConsequenceNeedNewInvitation),
          ],
          unsharingStatusLabel: t(CatalogI18nKeys.DetailsUnshareRemovingStatus),
          revokeShareLabel: t(ButtonsI18nKeys.RevokeAccess),
          revokeShareLabelWithCount: (count) =>
            t(ButtonsI18nKeys.RevokeAccessWithCount, { count }),
          revokeShareConfirmTitle: t(
            CatalogI18nKeys.DetailsRevokeShareConfirmTitle,
          ),
          revokeShareConfirmMessage: (name) =>
            t(CatalogI18nKeys.DetailsRevokeShareConfirmMessage, { name }),
          revokeShareConfirmConsequences: [
            t(CatalogI18nKeys.DetailsRevokeShareConsequenceOthersLoseAccess),
            t(CatalogI18nKeys.DetailsRevokeShareConsequenceLinksStopWorking),
            t(CatalogI18nKeys.DetailsRevokeShareConsequenceKeepsYourCopy),
          ],
          revokingShareStatusLabel: t(
            CatalogI18nKeys.DetailsRevokeShareRevokingStatus,
          ),
          unpublishLabel: t(ButtonsI18nKeys.Unpublish),
          unpublishConfirmTitle: t(
            CatalogI18nKeys.DetailsUnpublishConfirmTitle,
          ),
          unpublishConfirmMessage: (name, folder) =>
            t(CatalogI18nKeys.DetailsUnpublishConfirmMessage, { name, folder }),
          unpublishSelectFolderMessage: (name) =>
            t(CatalogI18nKeys.DetailsUnpublishSelectFolderMessage, { name }),
          unpublishFolderGroupAriaLabel: t(
            CatalogI18nKeys.DetailsUnpublishFolderGroupAriaLabel,
          ),
          unpublishConfirmConsequences: [
            t(CatalogI18nKeys.DetailsUnpublishConsequenceEveryoneLosesAccess),
            t(CatalogI18nKeys.DetailsUnpublishConsequenceKeepsYourCopy),
            t(CatalogI18nKeys.DetailsUnpublishConsequenceCanPublishAgain),
          ],
          unpublishingStatusLabel: t(
            CatalogI18nKeys.DetailsUnpublishRequestingStatus,
          ),
          loggingOutStatusLabel: t(AuthI18nKeys.LoggingOutStatus),
          cancelLabel: t(ButtonsI18nKeys.Cancel),
        }}
      />
    </>
  );
};

export default memo(CatalogView);

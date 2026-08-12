import {
  Catalog,
  CatalogEntityType,
  CatalogItem,
  CatalogItemDetailsFetchResult,
  CatalogViewMode,
  CredentialsLevel,
  CredentialStatus,
} from '@epam/ai-dial-catalog';
import type { ToolsetLogoutBodyDto } from '@epam/ai-dial-chat-api-client';
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { triggerBlobDownload } from '@epam/ai-dial-chat-shared';
import type { PublicationRule } from '@epam/ai-dial-publish-panel';
import { DropdownItem, NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { QUERY_VALUE_TRUE } from '../../constants/apps-editor';
import {
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  ToolsetEditorQuery,
} from '../../constants/toolsets';
import {
  ApiI18nKeys,
  AuthI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  DialFileManagerI18nKeys,
  FavoritesI18nKeys,
  NavigationI18nKeys,
  PublishI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useFavoriteApplications } from '../../context/FavoriteApplicationsContext';
import { useNotification } from '../../context/NotificationContext';
import { usePrompts } from '../../context/PromptsContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import { usePublishErrorNotification } from '../../hooks/publish/usePublishErrorNotification';
import { usePublishFolders } from '../../hooks/publish/usePublishFolders';
import {
  ToolsetLoginOutcomeType,
  useToolsetLogin,
} from '../../hooks/toolsets/useToolsetLogin';
import { useCatalogSortFilterPreference } from '../../hooks/useCatalogSortFilterPreference/useCatalogSortFilterPreference';
import { useUiFeature } from '../../hooks/useUiFeature';
import { getApiErrorDetails } from '../../server-api/api-error';
import { deleteApplication } from '../../server-api/applications';
import { getDeploymentLimits } from '../../server-api/deployment-limits';
import { getDeploymentDetails } from '../../server-api/deployments';
import {
  deletePrompt,
  getPrompt,
  getPublicPrompt,
} from '../../server-api/prompts.api';
import {
  getPublishRules,
  toPublishRuleDto,
} from '../../server-api/publish-rules.api';
import { publishCatalogEntity } from '../../server-api/publish.api';
import {
  discardSharedCatalogItem,
  revokeSharedAccess,
} from '../../server-api/share.api';
import { deleteToolset, logoutToolset } from '../../server-api/toolsets';
import { AppsEditorQuery, AppsEditorStep } from '../../types/apps-editor';
import { CatalogQuery } from '../../types/catalog';
import { PromptSource } from '../../types/prompt';
import { PromptEditorQuery } from '../../types/prompt-editor';
import { ROUTES } from '../../types/routes';
import { isQuickAppSchema } from '../../utils/application-schema';
import { findDeploymentByIdOrReference } from '../../utils/deployment-id';
import { EXPORT_APP_NAME } from '../../utils/export-conversation';
import {
  buildPromptExportEnvelope,
  buildPromptExportFileName,
  serializePromptExport,
} from '../../utils/export-prompt';
import { resolveFavoriteEntityType } from '../../utils/favorites';
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
import {
  buildPromptOverview,
  isOrganisationPromptItem,
  mapPromptToCatalogItem,
} from '../../utils/map-prompt-to-catalog-item';
import {
  buildConnectApi,
  resolveMcpResourceKind,
} from '../../utils/mcp-endpoint-url';
import { getAccessRulesLabels, toPublishEntityType } from '../../utils/publish';
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
}

const CatalogView: FC<Props> = ({
  isSelectorMode = false,
  onClose,
  onSelect,
  visibleTypes = PICKER_VISIBLE_TYPES,
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
  const isCustomAppsEnabled = useUiFeature(OverlayFeature.CustomApps);
  const isCustomApplicationsEnabled = useUiFeature(
    OverlayFeature.CustomApplications,
  );
  const isHideCustomAppCreationEnabled = useUiFeature(
    OverlayFeature.HideCustomAppCreation,
  );
  const isPromptsEnabled = useUiFeature(OverlayFeature.Prompts);

  const {
    prompts,
    sharedWithMe: sharedPrompts,
    publicPrompts,
    refetchPrompts,
  } = usePrompts();

  const catalogItems = useMemo(() => {
    return [
      ...deployments.map((d) =>
        mapDeploymentToCatalogItem(d, {
          favoriteIds,
          t,
          editableSchemaIds: quickAppSchemaId ? [quickAppSchemaId] : [],
          isCustomAppsEditable: isCustomAppsEnabled,
          activeLocale: language,
        }),
      ),
      ...(isToolsetsEnabled
        ? toolsets.map((toolset) =>
            mapToolsetToCatalogItem(toolset, {
              favoriteIds,
              isAdmin,
              t,
              activeLocale: language,
            }),
          )
        : []),
      ...(isPromptsEnabled
        ? [
            ...prompts.map((prompt) =>
              mapPromptToCatalogItem(prompt, {
                t,
                source: PromptSource.Personal,
                favoriteIds,
              }),
            ),
            ...sharedPrompts.map((prompt) =>
              mapPromptToCatalogItem(prompt, {
                t,
                source: PromptSource.SharedWithMe,
                favoriteIds,
              }),
            ),
            ...publicPrompts.map((prompt) =>
              mapPromptToCatalogItem(prompt, {
                t,
                source: PromptSource.Public,
                favoriteIds,
              }),
            ),
          ]
        : []),
    ];
  }, [
    deployments,
    favoriteIds,
    t,
    language,
    toolsets,
    quickAppSchemaId,
    isAdmin,
    isToolsetsEnabled,
    isCustomAppsEnabled,
    isPromptsEnabled,
    prompts,
    sharedPrompts,
    publicPrompts,
  ]);

  const visibleCatalogItems = useMemo(() => {
    let result = isSelectorMode
      ? catalogItems.filter((item) => visibleTypes.has(item.type))
      : catalogItems;
    if (isCatalogHideMyAppsEnabled) {
      result = result.filter((item) => !item.isMyApp);
    }
    return result;
  }, [catalogItems, isSelectorMode, isCatalogHideMyAppsEnabled, visibleTypes]);

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
    rememberPublishFolder,
    hasPublishWriteAccess,
  } = usePublishFolders();

  const showPublishError = usePublishErrorNotification();

  const favorites = useMemo(
    () => visibleCatalogItems.filter((item) => item.isUserFavorite),
    [visibleCatalogItems],
  );

  const handleFetchDetails = useCallback(
    async (
      item: CatalogItem,
    ): Promise<CatalogItemDetailsFetchResult | undefined> => {
      /*
       * Prompts resolve through the prompts endpoints; neither deployment
       * endpoint accepts a prompt path. A failure here resolves `undefined`,
       * so the panel keeps the body the list mapper already seeded.
       */
      if (item.type === CatalogEntityType.Prompt) {
        try {
          const dto = isOrganisationPromptItem(item)
            ? await getPublicPrompt(item.id)
            : await getPrompt(item.id);
          /*
           * The fetch result replaces `item.details` wholesale, so the
           * Overview tab has to be rebuilt here too or it would disappear.
           */
          return {
            promptContent: { content: dto.content },
            overview: buildPromptOverview(dto, t),
          };
        } catch {
          return undefined;
        }
      }

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
        const catalogDetails = mapEntityDetailsToCatalogDetails(entityDetails);
        const mcpResourceKind = resolveMcpResourceKind(
          item.type,
          item.supportsMcp,
        );
        return {
          ...catalogDetails,
          api:
            mcpResourceKind != null
              ? buildConnectApi(
                  dialCoreExternalUrl ?? '',
                  item.id,
                  mcpResourceKind,
                )
              : catalogDetails.api,
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
    [isAdmin, t, dialCoreExternalUrl],
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
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
        showNotification({
          variant: NotificationVariant.Error,
          message: t(ToolsetEditorI18nKeys.ErrorLogoutFailed),
          requestId: traceId,
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
          resolveFavoriteEntityType(item?.type),
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
      } catch (error) {
        const { traceId } = await getApiErrorDetails(error);
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
          requestId: traceId,
        });
      }
    },
    [isLoading, toggleFavorite, catalogItems, showNotification, t],
  );

  const handleUseInChat = useCallback(
    async (item: CatalogItem) => {
      /*
       * A prompt contributes text, not a runtime: it seeds the composer and
       * leaves the user's selected deployment untouched. The body travels as
       * router state rather than a query param — it can run to 50 000
       * characters, which would blow the URL length limit and leak content
       * into browser history.
       */
      if (item.type === CatalogEntityType.Prompt) {
        let promptContent = item.details?.promptContent?.content;
        if (promptContent == null) {
          try {
            const dto = isOrganisationPromptItem(item)
              ? await getPublicPrompt(item.id)
              : await getPrompt(item.id);
            promptContent = dto.content;
          } catch (err) {
            const { traceId } = await getApiErrorDetails(err);
            showNotification({
              variant: NotificationVariant.Error,
              message: t(CatalogI18nKeys.DetailsPromptLoadError),
              requestId: traceId,
            });
            return;
          }
        }
        navigate(ROUTES.Root, { state: { promptContent } });
        return;
      }

      setSelectedItemId(item.id);
      navigate(ROUTES.Root);
    },
    [setSelectedItemId, navigate, showNotification, t],
  );

  /* Picker mode: a card click selects it and closes the modal immediately,
   * without opening its details. When `onSelect` is supplied (a form-owned
   * selection, decoupled from the chat input's active deployment), the pick
   * is routed there instead of committing to `DeploymentsContext`. */
  const handleCardSelect = useCallback(
    (item: CatalogItem) => {
      if (onSelect) {
        onSelect(item.id);
      } else {
        setSelectedItemId(item.id);
      }
      onClose?.();
    },
    [onSelect, setSelectedItemId, onClose],
  );

  /*
   * The body is re-fetched rather than taken from `item.details.promptContent`:
   * the listing seeds that field, so a prompt edited in another tab would be
   * written to disk stale. Organisation prompts download through the public
   * endpoint, exactly as their details do.
   */
  const handleDownload = useCallback(
    async (item: CatalogItem) => {
      if (item.type !== CatalogEntityType.Prompt) return;
      try {
        const dto = isOrganisationPromptItem(item)
          ? await getPublicPrompt(item.id)
          : await getPrompt(item.id);
        triggerBlobDownload(
          serializePromptExport(buildPromptExportEnvelope(dto)),
          buildPromptExportFileName(dto.name, EXPORT_APP_NAME),
        );
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        showNotification({
          variant: NotificationVariant.Error,
          message: t(CatalogI18nKeys.DetailsPromptDownloadError),
          requestId: traceId,
        });
      }
    },
    [showNotification, t],
  );

  /* Only a prompt has a downloadable body; every other type is backed by config the catalog does not export. */
  const isDownloadVisible = useCallback(
    (item: CatalogItem) => item.type === CatalogEntityType.Prompt,
    [],
  );

  const isPrimaryActionVisible = useCallback((item: CatalogItem) => {
    /*
     * A prompt contributes text rather than a runtime, so it is always
     * usable in chat; `supportsChat` describes a deployment's interfaces
     * and is absent on prompt items.
     */
    if (item.type === CatalogEntityType.Prompt) return true;
    return (
      (item.type === CatalogEntityType.Model ||
        item.type === CatalogEntityType.Agent) &&
      item.supportsChat !== false
    );
  }, []);

  /*
   * `DiscardSharedCatalogItemDto` restricts `itemId` to
   * `applications|toolsets|conversations` paths, so a prompt path is rejected
   * with 400 before reaching the service. Hide the action until the backend
   * accepts prompts.
   */
  const isUnshareVisible = useCallback(
    (item: CatalogItem) => item.type !== CatalogEntityType.Prompt,
    [],
  );

  /*
   * `RevokeSharedAccessDto` carries the same `applications|toolsets|conversations`
   * restriction as the discard DTO, so a prompt path is rejected with 400. The
   * built-in rule would otherwise keep the action visible, since prompt items
   * carry no `recipientsCount`.
   */
  const isRevokeShareVisible = useCallback(
    (item: CatalogItem) => item.type !== CatalogEntityType.Prompt,
    [],
  );

  const isPublishVisible = useCallback(
    (item: CatalogItem) =>
      Boolean(item.isMyApp) && toPublishEntityType(item.type) != null,
    [],
  );

  const isApplicationsSharingEnabled = useUiFeature(
    OverlayFeature.ApplicationsSharing,
  );
  const isToolsetsSharingEnabled = useUiFeature(OverlayFeature.ToolsetsSharing);
  const isShareVisible = useCallback(
    (item: CatalogItem) => {
      /*
       * Only your own prompts can be shared: DIAL Core grants access from the
       * owner's bucket, which is the only one the backend can qualify a
       * bucket-relative prompt path against.
       */
      if (item.type === CatalogEntityType.Prompt) return Boolean(item.isMyApp);
      if (item.type === CatalogEntityType.Toolset) {
        return isToolsetsSharingEnabled;
      }
      return isApplicationsSharingEnabled;
    },
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
        rules: rules.map(toPublishRuleDto),
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
      rememberPublishFolder(folderPath);
      showNotification({
        variant: NotificationVariant.Success,
        title: t(CatalogI18nKeys.PublishSuccessTitle),
        message: t(CatalogI18nKeys.PublishSuccess, {
          name: item.name,
          folder: folderPath[folderPath.length - 1],
        }),
      });
    },
    [rememberPublishFolder, showNotification, t],
  );

  const handlePublishError = useCallback(
    (_item: CatalogItem, _folderPath: string[], error: unknown) =>
      showPublishError(error),
    [showPublishError],
  );

  const handleEdit = useCallback(
    (item: CatalogItem) => {
      if (item.type === CatalogEntityType.Prompt) {
        const params = new URLSearchParams({
          [PromptEditorQuery.Id]: item.id,
          [PromptEditorQuery.ReturnUrl]: ROUTES.Catalog,
        });
        navigate(`${ROUTES.PromptEditor}?${params.toString()}`);
        return;
      }

      if (item.type === CatalogEntityType.Toolset) {
        const params = new URLSearchParams({
          [ToolsetEditorQuery.Id]: item.id,
          [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
        });
        navigate(`${ROUTES.ToolsetEditor}?${params.toString()}`);
        return;
      }

      const deployment = findDeploymentByIdOrReference(deployments, item.id);
      if (
        isCustomAppsEnabled &&
        deployment != null &&
        !deployment.applicationTypeSchemaId
      ) {
        const params = new URLSearchParams({
          [ToolsetEditorQuery.Id]: item.id,
          [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
        });
        navigate(`${ROUTES.CustomAppEditor}?${params.toString()}`);
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
    [
      deployments,
      isCustomAppsEnabled,
      quickAppSchemaId,
      navigate,
      buildEditorUrl,
    ],
  );

  const handleDelete = useCallback(
    async (item: CatalogItem) => {
      try {
        if (item.type === CatalogEntityType.Prompt) {
          await deletePrompt(item.id);
          await refetchPrompts();
        } else if (item.type === CatalogEntityType.Toolset) {
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
        const { traceId } = await getApiErrorDetails(err);
        showNotification({
          variant: NotificationVariant.Error,
          message: t(CatalogI18nKeys.DetailsDeleteError),
          requestId: traceId,
        });
        throw err;
      }
    },
    [refetchToolsets, refetchDeployments, refetchPrompts, showNotification, t],
  );

  const handleUnshare = useCallback(
    async (item: CatalogItem) => {
      try {
        await discardSharedCatalogItem(item.id);
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        showNotification({
          variant: NotificationVariant.Error,
          title: t(CatalogI18nKeys.DetailsUnshareErrorTitle),
          message: t(CatalogI18nKeys.DetailsUnshareError, { name: item.name }),
          requestId: traceId,
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
        message: t(CatalogI18nKeys.DetailsUnshareSuccess, { name: item.name }),
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

  /*
   * Revoking removes every *recipient's* access; the item itself stays in the
   * owner's catalog, so — unlike `handleUnshare` — there is nothing to refetch
   * and no selection to clear.
   */
  const handleRevokeShare = useCallback(
    async (item: CatalogItem) => {
      try {
        await revokeSharedAccess(item.id);
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        showNotification({
          variant: NotificationVariant.Error,
          title: t(CatalogI18nKeys.DetailsRevokeShareErrorTitle),
          message: t(CatalogI18nKeys.DetailsRevokeShareError, {
            name: item.name,
          }),
          requestId: traceId,
        });
        throw err;
      }

      showNotification({
        variant: NotificationVariant.Success,
        title: t(CatalogI18nKeys.DetailsRevokeShareSuccessTitle),
        message: t(CatalogI18nKeys.DetailsRevokeShareSuccess, {
          name: item.name,
        }),
      });
    },
    [showNotification, t],
  );

  const createOptions = useMemo<DropdownItem[]>(() => {
    const options: DropdownItem[] = [];

    if (
      quickAppSchemaId &&
      isCustomApplicationsEnabled &&
      !isHideCustomAppCreationEnabled
    ) {
      options.push({
        key: 'quick-app',
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
        key: 'toolset',
        label: t(CatalogI18nKeys.CreateToolset),
        onClick: () => {
          const params = new URLSearchParams({
            [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
          });
          navigate(`${ROUTES.ToolsetEditor}?${params.toString()}`);
        },
      });
    }

    if (isCustomAppsEnabled && !isHideCustomAppCreationEnabled) {
      options.push({
        key: 'custom-app',
        label: t(CatalogI18nKeys.CreateCustomApp),
        onClick: () => {
          const params = new URLSearchParams({
            [ToolsetEditorQuery.ReturnUrl]: ROUTES.Catalog,
          });
          navigate(`${ROUTES.CustomAppEditor}?${params.toString()}`);
        },
      });
    }

    if (isPromptsEnabled) {
      options.push({
        key: 'prompt',
        label: t(CatalogI18nKeys.CreatePrompt),
        onClick: () => {
          const params = new URLSearchParams({
            [PromptEditorQuery.ReturnUrl]: ROUTES.Catalog,
          });
          navigate(`${ROUTES.PromptEditor}?${params.toString()}`);
        },
      });
    }

    return options;
  }, [
    quickAppSchemaId,
    navigate,
    isPromptsEnabled,
    t,
    buildEditorUrl,
    isCustomApplicationsEnabled,
    isHideCustomAppCreationEnabled,
    isToolsetsEnabled,
    isCustomAppsEnabled,
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
      onDownload={handleDownload}
      isDownloadVisible={isDownloadVisible}
      onDelete={handleDelete}
      onUnshare={handleUnshare}
      isUnshareVisible={isUnshareVisible}
      onRevokeShare={handleRevokeShare}
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
      onPublishError={handlePublishError}
      ruleSourceOptions={config.publicationFilterSources}
      onFetchExistingRules={handleFetchExistingRules}
      publishLabels={{
        searchPlaceholder: t(CatalogI18nKeys.PublishFolderSearchPlaceholder),
        folderEmptyStateLabel: t(CatalogI18nKeys.PublishFolderEmptyState, {
          query: '{query}',
        }),
        historyLoadingLabel: t(CatalogI18nKeys.PublishHistoryLoading),
        historyErrorLabel: t(CatalogI18nKeys.PublishHistoryError),
        submitError: t(PublishI18nKeys.SubmitErrorCallout),
        accessRulesLabels: getAccessRulesLabels(t),
      }}
      shareOverlay={(item, onClose) => (
        <SharePopoverContainer item={item} onClose={onClose} />
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
          [CatalogEntityType.Prompt]: t(CatalogI18nKeys.TabPrompts),
        },
      }}
      detailsTexts={{
        tabToolsLabel: t(CatalogI18nKeys.DetailsTabTools),
        tabContentLabel: t(CatalogI18nKeys.DetailsTabContent),
        tabLimitsLabel: t(CatalogI18nKeys.DetailsTabLimits),
        primaryActionLabel: t(ButtonsI18nKeys.UseInChat),
        editActionLabel: t(ButtonsI18nKeys.Edit),
        downloadActionLabel: t(ButtonsI18nKeys.Download),
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
        loggingOutStatusLabel: t(AuthI18nKeys.LoggingOutStatus),
        cancelLabel: t(ButtonsI18nKeys.Cancel),
      }}
    />
  );
};

export default memo(CatalogView);

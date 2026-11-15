import {
  CatalogCreationType,
  TextRefinementPurpose,
} from '@epam/ai-dial-chat-api-client';
import type {
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  buildToolsetMcpUrl,
  createToolsetCreateAdapter,
  createToolsetSaveAdapter,
  getApiErrorDetails,
  parseResourceFolderPath,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  WithLogin,
  type ResourceSaveAdapter,
  type ResourceSaveResult,
} from '@epam/ai-dial-chat-hooks';
import {
  CatalogEntityType,
  ENTITY_DESCRIPTION_MAX_LENGTH,
  ENTITY_NAME_MAX_LENGTH,
} from '@epam/ai-dial-chat-shared';
import { McpDeploymentKind } from '@epam/ai-dial-mcp-apps';
import type {
  ToolsetAuthActions,
  ToolsetAuthFormData,
  ToolsetEditorLabels,
  ToolsetFormData,
} from '@epam/ai-dial-toolset-editor';
import {
  getDefaultToolsetForm,
  ToolsetEditor,
} from '@epam/ai-dial-toolset-editor';
import type { TFunction } from 'i18next';
import type { FC } from 'react';
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import RouteFallback from '../../../components/RouteFallback/RouteFallback';
import { ToolsetEditorQuery } from '../../../constants/toolsets';
import {
  ApiI18nKeys,
  AuthI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  EditorI18nKeys,
  ResourceSavePanelI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import { useAppConfig } from '../../../context/AppConfigContext';
import { useDeployments } from '../../../context/DeploymentsContext';
import { useNotification } from '../../../context/NotificationContext';
import { useApplicationAvatarPicker } from '../../../hooks/application-editor/useApplicationAvatarPicker';
import { useMetadataLabels } from '../../../hooks/application-editor/useMetadataLabels';
import { useCatalogCreationDecision } from '../../../hooks/catalog/useCatalogCreationDecision';
import { useToolsetEditorOAuthLogin } from '../../../hooks/toolsets/useToolsetEditorOAuthLogin';
import { useBuilderLeaveGuard } from '../../../hooks/unsaved-changes/useBuilderLeaveGuard';
import { useOperationNotification } from '../../../hooks/useOperationNotification';
import { useTextRefinementCallback } from '../../../hooks/useTextRefinementCallback';
import { useTextRefinementLabels } from '../../../hooks/useTextRefinementLabels';
import { toolsetsApi } from '../../../server-api/api-client';
import { mcpAppsApiClient } from '../../../server-api/mcp-apps';
import {
  getToolset,
  listToolsetFolders,
  loginToolset,
  logoutToolset,
  updateToolset,
} from '../../../server-api/toolsets';
import { CatalogCreationDecision } from '../../../types/catalog-creation';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../../types/entity-notification';
import { ROUTES } from '../../../types/routes';
import {
  buildAdditionalLocaleOptions,
  getLocaleDisplayName,
} from '../../../utils/locale';
import {
  extractToolsetApiErrorMessage,
  fetchToolsetAuthSettings,
  formToToolsetBody,
  getToolsetRedirectUri,
  toolsetDtoToForm,
} from '../../../utils/toolsets';

/* Loaded on the first Save of an edit session, so opening the editor fetches no folder listing. */
const ResourceSavePanelContainer = lazy(
  async () =>
    import('../../../components/ResourceSavePanelContainer/ResourceSavePanelContainer'),
);

/** What the Save panel needs for the save it was opened for. */
interface ToolsetSaveRequest {
  adapter: ResourceSaveAdapter;
  name: string;
  version: string;
  iconUrl?: string;
}

const getMetadataLabelOverrides = (t: TFunction) => ({
  name: {
    label: t(EditorI18nKeys.NameLabel),
    placeholder: t(ToolsetEditorI18nKeys.NamePlaceholder),
  },
  description: {
    label: t(EditorI18nKeys.DescriptionLabel),
    placeholder: t(ToolsetEditorI18nKeys.DescriptionPlaceholder),
  },
  topics: {
    label: t(EditorI18nKeys.TopicsLabel),
    placeholder: t(EditorI18nKeys.TopicsPlaceholder),
  },
});

/** Host adapter for the toolset editor library: data loading, persistence, auth, and labels. */
const ToolsetApplicationEditor: FC = () => {
  const { t } = useTranslation();
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const { refetchToolsets } = useDeployments();
  const { config } = useAppConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const routeToolsetId = searchParams.get(ToolsetEditorQuery.Id) ?? '';
  const isEditMode = Boolean(routeToolsetId);
  /* The page boundary gates opening the create form; this re-check blocks a
   * create whose permission was lost while the form was open. */
  const creationDecision = useCatalogCreationDecision({
    type: CatalogCreationType.Toolset,
  });
  const returnUrl = ROUTES.Catalog;

  const [initialForm, setInitialForm] = useState<ToolsetFormData | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(isEditMode);
  /* Only the user's own toolset saves through the Save panel: moving and forking act on the caller's bucket. */
  const [isOwnToolset, setIsOwnToolset] = useState(false);
  /* Set once this session creates the toolset through the Save panel, so later Saves edit that toolset where it lives. */
  const [createdToolsetId, setCreatedToolsetId] = useState<string>();
  const editedToolsetId = routeToolsetId || createdToolsetId || '';

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (isEditMode) {
        setIsLoading(true);
        try {
          const dto = await getToolset(routeToolsetId);
          const loadedForm = toolsetDtoToForm(dto);
          if (!cancelled) {
            setInitialForm(loadedForm);
            setIsOwnToolset(dto.isMy === true);
          }
        } catch {
          // Edit target missing/unreachable — leave the editor.
          if (!cancelled) navigate(returnUrl, { replace: true });
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      setInitialForm(getDefaultToolsetForm());
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, routeToolsetId, navigate, returnUrl]);

  const { avatarPicker, avatarPickerLabels } = useApplicationAvatarPicker();
  const [saveRequest, setSaveRequest] = useState<ToolsetSaveRequest>();
  const [isSavePanelOpen, setIsSavePanelOpen] = useState(false);
  const pendingPersistRef = useRef<((id: string | null) => void) | null>(null);

  const handlePersist = useCallback(
    async (
      form: ToolsetFormData,
      toolsetId: string,
    ): Promise<string | null> => {
      if (!toolsetId && creationDecision !== CatalogCreationDecision.Allowed) {
        showErrorNotification({
          message: t(
            creationDecision === CatalogCreationDecision.Denied
              ? CatalogI18nKeys.CreationDenied
              : CatalogI18nKeys.CreationUnavailable,
          ),
        });
        return null;
      }
      if (!toolsetId || isOwnToolset) {
        const isCreate = !toolsetId;
        const body = formToToolsetBody(
          form,
          getToolsetRedirectUri(),
          !isCreate,
        );
        /*
         * The editor awaits this promise before its post-save login and exit,
         * so the Save panel settles it: with the saved id (a created, moved or
         * new version's own), or with `null` when the user cancels.
         */
        return new Promise<string | null>((resolve) => {
          pendingPersistRef.current?.(null);
          pendingPersistRef.current = resolve;
          setSaveRequest({
            adapter: isCreate
              ? createToolsetCreateAdapter({ toolsetsApi, body })
              : createToolsetSaveAdapter({ toolsetsApi, toolsetId, body }),
            name: form.name.trim(),
            version: form.version.trim(),
            iconUrl: avatarPicker.resolveIconUrl?.(form.iconUrl),
          });
          setIsSavePanelOpen(true);
        });
      }
      /* Only a toolset shared with the user reaches here; it saves in place. */
      try {
        const body = formToToolsetBody(form, getToolsetRedirectUri(), true);
        const result = await updateToolset(toolsetId, body);
        return result.id;
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        const upstreamMessage = await extractToolsetApiErrorMessage(err);
        showErrorNotification({
          message:
            upstreamMessage ?? t(ToolsetEditorI18nKeys.ErrorUpdateFailed),
          requestId: traceId,
        });
        return null;
      }
    },
    [avatarPicker, creationDecision, isOwnToolset, t, showErrorNotification],
  );

  /* The panel notifies on its own, so the editor's own success toast is skipped once. */
  const isSavedThroughPanelRef = useRef(false);
  const settlePendingPersist = useCallback((id: string | null) => {
    const resolve = pendingPersistRef.current;
    pendingPersistRef.current = null;
    resolve?.(id);
  }, []);
  const handleSavePanelClose = useCallback(() => {
    setIsSavePanelOpen(false);
    settlePendingPersist(null);
  }, [settlePendingPersist]);
  const handleSavePanelSaved = useCallback(
    (result: ResourceSaveResult) => {
      isSavedThroughPanelRef.current = true;
      setIsSavePanelOpen(false);
      if (result.isCreated) {
        setCreatedToolsetId(result.savedId);
        setIsOwnToolset(true);
      }
      settlePendingPersist(result.savedId);
      void refetchToolsets().catch(() => undefined);
    },
    [refetchToolsets, settlePendingPersist],
  );
  // A persist still waiting on the panel must not hang the editor after unmount.
  useEffect(() => () => settlePendingPersist(null), [settlePendingPersist]);
  const currentFolderPath = useMemo(
    () => parseResourceFolderPath(editedToolsetId),
    [editedToolsetId],
  );

  const handlePostSaveLogin = useCallback(
    async (toolsetId: string, auth: ToolsetAuthFormData): Promise<void> => {
      if (auth.isLoggedIn) return;

      if (
        auth.authenticationType === ToolsetAuthTypes.ApiKey &&
        auth.withLogin === WithLogin.WithLogin
      ) {
        const body: ToolsetLoginBodyDto = {
          url: toolsetId,
          credentialsLevel:
            ToolsetCredentialsLevel.User as ToolsetLoginBodyDto['credentialsLevel'],
          authenticationType:
            ToolsetAuthTypes.ApiKey as ToolsetLoginBodyDto['authenticationType'],
          apiKey: auth.apiKey?.trim(),
        };
        await loginToolset(toolsetId, body);
      }
    },
    [],
  );

  /* The OAuth popup flow, its callback route and credentials level are owned here, not by the editor library. */
  const handleOAuthLogin = useToolsetEditorOAuthLogin();

  const authActions = useMemo<ToolsetAuthActions>(
    () => ({
      login: (toolsetId, body) =>
        loginToolset(toolsetId, {
          url: body.url,
          credentialsLevel:
            body.credentialsLevel as ToolsetLoginBodyDto['credentialsLevel'],
          authenticationType:
            body.authenticationType as ToolsetLoginBodyDto['authenticationType'],
          apiKey: body.apiKey,
        }),
      logout: (toolsetId, body) =>
        logoutToolset(toolsetId, {
          url: body.url,
          credentialsLevel:
            body.credentialsLevel as ToolsetLogoutBodyDto['credentialsLevel'],
          authenticationType:
            body.authenticationType as ToolsetLogoutBodyDto['authenticationType'],
        }),
      fetchAuthSettings: fetchToolsetAuthSettings,
    }),
    [],
  );

  const handleSaveSuccess = useCallback(
    (form: ToolsetFormData) => {
      if (isSavedThroughPanelRef.current) {
        isSavedThroughPanelRef.current = false;
        return;
      }
      notifyOperationSuccess(
        NotifiableEntity.Toolset,
        isEditMode ? EntityOperation.Edited : EntityOperation.Created,
        { name: form.name.trim() },
      );
    },
    [notifyOperationSuccess, isEditMode],
  );

  /* Reported by the editor; feeds the router-level leave guard. */
  const [isDirty, setIsDirty] = useState(false);
  const { allowNextNavigation } = useBuilderLeaveGuard({ isDirty });

  const handleSaveComplete = useCallback(() => {
    allowNextNavigation();
    navigate(returnUrl);
  }, [allowNextNavigation, navigate, returnUrl]);

  const handleBack = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

  const buildMcpUrl = useMemo(() => {
    const dialCoreExternalUrl = config.dialCoreExternalUrl;
    return dialCoreExternalUrl
      ? (toolsetId: string) =>
          buildToolsetMcpUrl(dialCoreExternalUrl, toolsetId)
      : undefined;
  }, [config.dialCoreExternalUrl]);

  const listToolNames = useCallback(
    (toolsetId: string) =>
      mcpAppsApiClient.listToolNames(toolsetId, McpDeploymentKind.Toolset),
    [],
  );

  const notifySuccess = useCallback(
    (message: string) => showSuccessNotification({ message }),
    [showSuccessNotification],
  );

  const notifyError = useCallback(
    (message: string, requestId?: string) =>
      showErrorNotification({ message, requestId }),
    [showErrorNotification],
  );

  const metadataFormLabels = useMetadataLabels(getMetadataLabelOverrides);

  const localeOptions = useMemo(
    () => buildAdditionalLocaleOptions(config.additionalContentLocales),
    [config.additionalContentLocales],
  );
  const onRefineDescription = useTextRefinementCallback(
    TextRefinementPurpose.ToolsetDescription,
  );
  const refinementLabels = useTextRefinementLabels();

  const labels = useMemo<ToolsetEditorLabels>(
    () => ({
      versionReadOnlyTooltip: t(
        ResourceSavePanelI18nKeys.VersionReadOnlyTooltip,
      ),
      refinement: refinementLabels,
      layout: {
        createTitle: t(ToolsetEditorI18nKeys.CreateTitle),
        editTitle: t(ToolsetEditorI18nKeys.EditTitle),
        backAriaLabel: t(EditorI18nKeys.BackAriaLabel),
        savingStatusLabel: t(ButtonsI18nKeys.Saving),
        metadataSectionTitle: t(EditorI18nKeys.MetadataSectionTitle),
        setupSectionTitle: t(EditorI18nKeys.SetupSectionTitle),
        cancelLabel: t(ButtonsI18nKeys.Cancel),
        saveLabel: t(ButtonsI18nKeys.Save),
        createLabel: t(ButtonsI18nKeys.Create),
      },
      validation: {
        nameRequired: t(EditorI18nKeys.NameRequired),
        nameTooLong: t(EditorI18nKeys.FieldTooLong, {
          count: ENTITY_NAME_MAX_LENGTH,
        }),
        nameControlCharacters: t(EditorI18nKeys.NameControlCharacters),
        descriptionTooLong: t(EditorI18nKeys.FieldTooLong, {
          count: ENTITY_DESCRIPTION_MAX_LENGTH,
        }),
        versionInvalid: t(ToolsetEditorI18nKeys.VersionInvalid),
        endpointRequired: t(ToolsetEditorI18nKeys.EndpointRequired),
        endpointInvalid: t(ToolsetEditorI18nKeys.EndpointInvalid),
        keyHeaderRequired: t(ToolsetEditorI18nKeys.KeyHeaderRequired),
        apiKeyRequired: t(ToolsetEditorI18nKeys.ApiKeyRequired),
        clientIdRequired: t(ToolsetEditorI18nKeys.ClientIdRequired),
        clientSecretRequired: t(ToolsetEditorI18nKeys.ClientSecretRequired),
        authorizationEndpointRequired: t(
          ToolsetEditorI18nKeys.AuthorizationEndpointRequired,
        ),
        tokenEndpointRequired: t(ToolsetEditorI18nKeys.TokenEndpointRequired),
        resourceInvalid: t(ToolsetEditorI18nKeys.ResourceInvalid),
      },
      general: {
        form: metadataFormLabels,
        avatarPicker: avatarPickerLabels,
      },
      settings: {
        endpointLabel: t(ApiI18nKeys.EndpointLabel),
        endpointCaption: t(ToolsetEditorI18nKeys.EndpointCaption),
        endpointPlaceholder: t(BasicI18nKeys.UrlPlaceholder),
        protocolLabel: t(ToolsetEditorI18nKeys.ProtocolLabel),
        allowedToolsLabel: t(ToolsetEditorI18nKeys.AllowedToolsLabel),
        allowedToolsPlaceholder: t(
          ToolsetEditorI18nKeys.AllowedToolsPlaceholder,
        ),
        allowedToolsSelectPlaceholder: t(
          ToolsetEditorI18nKeys.AllowedToolsSelectPlaceholder,
        ),
        connect: {
          title: t(CatalogI18nKeys.ConnectToolsetTitle),
          description: t(CatalogI18nKeys.ConnectToolsetDescription),
          copyLabel: t(ButtonsI18nKeys.CopyUrl),
          copiedLabel: t(ButtonsI18nKeys.Copied),
        },
        auth: {
          sectionTitle: t(ToolsetEditorI18nKeys.AuthSectionTitle),
          typeOAuth: t(ToolsetEditorI18nKeys.AuthTypeOAuth),
          typeApiKey: t(ToolsetEditorI18nKeys.AuthTypeApiKey),
          typeNone: t(ToolsetEditorI18nKeys.AuthTypeNone),
          withLoginLabel: t(ToolsetEditorI18nKeys.WithLoginLabel),
          withoutLoginLabel: t(ToolsetEditorI18nKeys.WithoutLoginLabel),
          withLoginOAuthLabel: t(ToolsetEditorI18nKeys.WithLoginOAuthLabel),
          withConfigOAuthLabel: t(ToolsetEditorI18nKeys.WithConfigOAuthLabel),
          openAccessDescription: t(ToolsetEditorI18nKeys.OpenAccessDescription),
          keyHeaderLabel: t(ToolsetEditorI18nKeys.KeyHeaderLabel),
          keyHeaderPlaceholder: t(ToolsetEditorI18nKeys.KeyHeaderPlaceholder),
          apiKeyLabel: t(ApiI18nKeys.ApiKey),
          apiKeyPlaceholder: t(ToolsetEditorI18nKeys.ApiKeyPlaceholder),
          showApiKeyLabel: t(ToolsetEditorI18nKeys.ShowApiKeyLabel),
          hideApiKeyLabel: t(ToolsetEditorI18nKeys.HideApiKeyLabel),
          clientIdLabel: t(ToolsetEditorI18nKeys.ClientIdLabel),
          clientIdPlaceholder: t(ToolsetEditorI18nKeys.ClientIdPlaceholder),
          clientSecretLabel: t(ToolsetEditorI18nKeys.ClientSecretLabel),
          clientSecretPlaceholder: t(
            ToolsetEditorI18nKeys.ClientSecretPlaceholder,
          ),
          clientSecretKeepCaption: t(
            ToolsetEditorI18nKeys.ClientSecretKeepCaption,
          ),
          showClientSecretLabel: t(ToolsetEditorI18nKeys.ShowClientSecretLabel),
          hideClientSecretLabel: t(ToolsetEditorI18nKeys.HideClientSecretLabel),
          authorizationEndpointLabel: t(
            ToolsetEditorI18nKeys.AuthorizationEndpointLabel,
          ),
          authorizationEndpointPlaceholder: t(
            ToolsetEditorI18nKeys.AuthorizationEndpointPlaceholder,
          ),
          tokenEndpointLabel: t(ToolsetEditorI18nKeys.TokenEndpointLabel),
          tokenEndpointPlaceholder: t(
            ToolsetEditorI18nKeys.TokenEndpointPlaceholder,
          ),
          scopesLabel: t(ToolsetEditorI18nKeys.ScopesLabel),
          scopesPlaceholder: t(ToolsetEditorI18nKeys.ScopesPlaceholder),
          resourceLabel: t(ToolsetEditorI18nKeys.ResourceLabel),
          resourcePlaceholder: t(ToolsetEditorI18nKeys.ResourcePlaceholder),
          logInLabel: t(ButtonsI18nKeys.LogIn),
          logOutLabel: t(ButtonsI18nKeys.LogOut),
          cancelLabel: t(ButtonsI18nKeys.Cancel),
          loginSuccessMessage: t(ToolsetEditorI18nKeys.LoginSuccess),
          logoutSuccessMessage: t(ToolsetEditorI18nKeys.LogoutSuccess),
          logoutConfirmTitle: t(AuthI18nKeys.LogOutConfirmTitle),
          logoutConfirmDescription: t(
            ToolsetEditorI18nKeys.LogoutConfirmDescription,
          ),
          errorLoginFailed: t(ToolsetEditorI18nKeys.ErrorLoginFailed),
          errorLogoutFailed: t(ToolsetEditorI18nKeys.ErrorLogoutFailed),
          errorPopupBlocked: t(ToolsetEditorI18nKeys.ErrorPopupBlocked),
          errorOAuthConfigMissing: t(
            ToolsetEditorI18nKeys.ErrorOAuthConfigMissing,
          ),
        },
      },
    }),
    [t, metadataFormLabels, avatarPickerLabels, refinementLabels],
  );

  if (isLoading || !initialForm) {
    return <RouteFallback />;
  }

  return (
    <>
      <ToolsetEditor
        initialForm={initialForm}
        toolsetId={routeToolsetId}
        onPersist={handlePersist}
        onPostSaveLogin={handlePostSaveLogin}
        onToolsetsChanged={refetchToolsets}
        onSaveSuccess={handleSaveSuccess}
        onSaveComplete={handleSaveComplete}
        onBack={handleBack}
        onDirtyChange={setIsDirty}
        buildMcpUrl={buildMcpUrl}
        listToolNames={listToolNames}
        authActions={authActions}
        onOAuthLogin={handleOAuthLogin}
        onNotifySuccess={notifySuccess}
        onNotifyError={notifyError}
        avatarPicker={avatarPicker}
        availableLocaleOptions={localeOptions}
        formatLocaleLabel={getLocaleDisplayName}
        onRefineDescription={onRefineDescription}
        labels={labels}
        isVersionReadOnly={isEditMode}
      />
      {saveRequest && (
        <Suspense fallback={null}>
          <ResourceSavePanelContainer
            isOpen={isSavePanelOpen}
            onClose={handleSavePanelClose}
            adapter={saveRequest.adapter}
            listPersonalFolders={listToolsetFolders}
            resourceId={editedToolsetId}
            currentFolderPath={currentFolderPath}
            resourceName={saveRequest.name}
            currentVersion={saveRequest.version}
            resourceType={CatalogEntityType.Toolset}
            iconUrl={saveRequest.iconUrl}
            typeLabel={t(CatalogI18nKeys.CreateToolset)}
            notifiableEntity={NotifiableEntity.Toolset}
            canPublish
            onSaved={handleSavePanelSaved}
          />
        </Suspense>
      )}
    </>
  );
};

export default memo(ToolsetApplicationEditor);

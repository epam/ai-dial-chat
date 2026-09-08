import type {
  ToolsetLoginBodyDto,
  ToolsetLogoutBodyDto,
} from '@epam/ai-dial-chat-api-client';
import {
  buildToolsetMcpUrl,
  getApiErrorDetails,
  ToolsetAuthTypes,
  ToolsetCredentialsLevel,
  WithLogin,
} from '@epam/ai-dial-chat-hooks';
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
import type { FC } from 'react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import DialFileManagerModal from '../../components/DialFileManagerModal/DialFileManagerModal';
import RouteFallback from '../../components/RouteFallback/RouteFallback';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
} from '../../constants/files';
import { ToolsetEditorQuery } from '../../constants/toolsets';
import {
  ApiI18nKeys,
  AuthI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  CatalogI18nKeys,
  DialFileManagerI18nKeys,
  EditorI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useUser } from '../../context/auth/UserContext';
import { useDeployments } from '../../context/DeploymentsContext';
import { useNotification } from '../../context/NotificationContext';
import { useOperationNotification } from '../../hooks/useOperationNotification';
import { mcpAppsApiClient } from '../../server-api/mcp-apps';
import {
  createToolset,
  getToolset,
  listToolsets,
  loginToolset,
  logoutToolset,
  updateToolset,
} from '../../server-api/toolsets';
import {
  EntityOperation,
  NotifiableEntity,
} from '../../types/entity-notification';
import { ROUTES } from '../../types/routes';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import {
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
  PRIMARY_LOCALE,
  resolveLocalizedText,
} from '../../utils/locale';
import {
  extractToolsetApiErrorMessage,
  fetchToolsetAuthSettings,
  formToToolsetBody,
  getToolsetRedirectUri,
  toolsetDtoToForm,
} from '../../utils/toolsets';

const ToolsetEditorPage: FC = () => {
  const { t } = useTranslation();
  const { showSuccessNotification, showErrorNotification } = useNotification();
  const { notifyOperationSuccess } = useOperationNotification();
  const { refetchToolsets } = useDeployments();
  const { user } = useUser();
  const { config } = useAppConfig();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const routeToolsetId = searchParams.get(ToolsetEditorQuery.Id) ?? '';
  const isEditMode = Boolean(routeToolsetId);
  const returnUrl = useMemo(() => {
    const raw = searchParams.get(ToolsetEditorQuery.ReturnUrl);
    return raw?.startsWith('/') && !raw.startsWith('//') ? raw : ROUTES.Catalog;
  }, [searchParams]);

  const [initialForm, setInitialForm] = useState<ToolsetFormData | undefined>(
    undefined,
  );
  const [isLoading, setIsLoading] = useState(isEditMode);

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
          }
        } catch {
          // Edit target missing/unreachable — leave the editor.
          if (!cancelled) navigate(returnUrl, { replace: true });
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      try {
        const { data } = await listToolsets();
        if (!cancelled) {
          setInitialForm(
            getDefaultToolsetForm(
              (data ?? []).map((item) =>
                resolveLocalizedText(item.displayName, PRIMARY_LOCALE),
              ),
            ),
          );
        }
      } catch {
        if (!cancelled) setInitialForm(getDefaultToolsetForm());
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, routeToolsetId, navigate, returnUrl]);

  const handlePersist = useCallback(
    async (
      form: ToolsetFormData,
      toolsetId: string,
    ): Promise<string | null> => {
      try {
        const body = formToToolsetBody(form, getToolsetRedirectUri());
        if (toolsetId) {
          const result = await updateToolset(toolsetId, body);
          return result.id;
        }
        const result = await createToolset(body);
        return result.id;
      } catch (err) {
        const { traceId } = await getApiErrorDetails(err);
        const upstreamMessage = await extractToolsetApiErrorMessage(err);
        showErrorNotification({
          message:
            upstreamMessage ??
            t(
              toolsetId
                ? ToolsetEditorI18nKeys.ErrorUpdateFailed
                : ToolsetEditorI18nKeys.ErrorCreateFailed,
            ),
          requestId: traceId,
        });
        return null;
      }
    },
    [t, showErrorNotification],
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
      notifyOperationSuccess(
        NotifiableEntity.Toolset,
        isEditMode ? EntityOperation.Edited : EntityOperation.Created,
        { name: form.name.trim() },
      );
    },
    [notifyOperationSuccess, isEditMode],
  );

  const handleSaveComplete = useCallback(() => {
    navigate(returnUrl);
  }, [navigate, returnUrl]);

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
    (toolsetId: string) => mcpAppsApiClient.listToolNames(toolsetId, 'toolset'),
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

  const bucket = user?.bucket ?? '';

  const localeOptions = useMemo(() => buildAdditionalLocaleOptions(), []);

  const labels = useMemo<ToolsetEditorLabels>(
    () => ({
      layout: {
        createTitle: t(ToolsetEditorI18nKeys.CreateTitle),
        editTitle: t(ToolsetEditorI18nKeys.EditTitle),
        backAriaLabel: t(ToolsetEditorI18nKeys.BackAriaLabel),
        savingStatusLabel: t(ToolsetEditorI18nKeys.SavingStatus),
        metadataSectionTitle: t(ToolsetEditorI18nKeys.MetadataSectionTitle),
        setupSectionTitle: t(ToolsetEditorI18nKeys.SetupSectionTitle),
        cancelLabel: t(ButtonsI18nKeys.Cancel),
        saveLabel: t(ButtonsI18nKeys.Save),
        createLabel: t(ButtonsI18nKeys.Create),
      },
      validation: {
        nameRequired: t(EditorI18nKeys.NameRequired),
        versionInvalid: t(ToolsetEditorI18nKeys.VersionInvalid),
        endpointRequired: t(ToolsetEditorI18nKeys.EndpointRequired),
        endpointInvalid: t(ToolsetEditorI18nKeys.EndpointInvalid),
        keyHeaderRequired: t(ToolsetEditorI18nKeys.KeyHeaderRequired),
        apiKeyRequired: t(ToolsetEditorI18nKeys.ApiKeyRequired),
        clientIdRequired: t(ToolsetEditorI18nKeys.ClientIdRequired),
        clientSecretRequired: t(ToolsetEditorI18nKeys.ClientSecretRequired),
      },
      general: {
        form: {
          name: {
            label: t(EditorI18nKeys.NameLabel),
            placeholder: t(ToolsetEditorI18nKeys.NamePlaceholder),
          },
          description: {
            label: t(EditorI18nKeys.DescriptionLabel),
            placeholder: t(ToolsetEditorI18nKeys.DescriptionPlaceholder),
          },
          iconUrl: {
            label: t(EditorI18nKeys.AvatarLabel),
            addAvatarLabel: t(EditorI18nKeys.AddAvatarButtonLabel),
            captionText: t(EditorI18nKeys.AvatarCaption),
          },
          version: {
            label: t(EditorI18nKeys.VersionLabel),
            placeholder: t(EditorI18nKeys.VersionPlaceholder),
          },
          topics: {
            label: t(EditorI18nKeys.TopicsLabel),
            placeholder: t(ToolsetEditorI18nKeys.TopicsPlaceholder),
          },
          otherLocales: buildLocaleFieldLabels(t),
          ariaLabel: t(EditorI18nKeys.StepGeneral),
        },
        avatarPicker: {
          title: t(EditorI18nKeys.AddAvatarButtonLabel),
          attachLabel: t(DialFileManagerI18nKeys.Attach),
          emptyTitle: t(DialFileManagerI18nKeys.Empty),
          emptyDescription: '',
          errorMessage: t(DialFileManagerI18nKeys.Error),
          retryLabel: t(DialFileManagerI18nKeys.Retry),
          hiddenFilesLabel: t(DialFileManagerI18nKeys.HiddenFiles),
          showHiddenFilesLabel: t(DialFileManagerI18nKeys.ShowHiddenFiles),
          hideHiddenFilesLabel: t(DialFileManagerI18nKeys.HideHiddenFiles),
          getSelectionLabel: (count: number) =>
            t(DialFileManagerI18nKeys.ItemsSelected, { count }),
          uploadFilesLabel: t(DialFileManagerI18nKeys.Upload),
          newFolderLabel: t(DialFileManagerI18nKeys.NewFolder),
          downloadLabel: t(ButtonsI18nKeys.Download),
          downloadingLabel: t(DialFileManagerI18nKeys.Downloading),
          deleteLabel: t(ButtonsI18nKeys.Delete),
          deletingLabel: t(DialFileManagerI18nKeys.DeletingLabel),
          deleteConfirmTitleSingle: t(
            DialFileManagerI18nKeys.DeleteConfirmTitleSingle,
          ),
          deleteConfirmTitleMultiple: t(
            DialFileManagerI18nKeys.DeleteConfirmTitleMultiple,
          ),
          deleteConfirmSingleText: t(BasicI18nKeys.DeleteConfirmDescription),
          deleteConfirmMultipleText: t(
            DialFileManagerI18nKeys.DeleteConfirmBodyMultiple,
          ),
          deleteConfirmItemsLabel: t(
            DialFileManagerI18nKeys.DeleteConfirmBodyItems,
          ),
          deleteConfirmLabel: t(ButtonsI18nKeys.Delete),
          deleteCancelLabel: t(ButtonsI18nKeys.Cancel),
          uploadProgressTitle: t(DialFileManagerI18nKeys.UploadProgressTitle),
          cancelLabel: t(ButtonsI18nKeys.Cancel),
        },
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
          clientIdLabel: t(ToolsetEditorI18nKeys.ClientIdLabel),
          clientIdPlaceholder: t(ToolsetEditorI18nKeys.ClientIdPlaceholder),
          clientSecretLabel: t(ToolsetEditorI18nKeys.ClientSecretLabel),
          clientSecretPlaceholder: t(
            ToolsetEditorI18nKeys.ClientSecretPlaceholder,
          ),
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
    [t],
  );

  if (isLoading || !initialForm) {
    return <RouteFallback />;
  }

  return (
    <ToolsetEditor
      initialForm={initialForm}
      toolsetId={routeToolsetId}
      onPersist={handlePersist}
      onPostSaveLogin={handlePostSaveLogin}
      onToolsetsChanged={refetchToolsets}
      onSaveSuccess={handleSaveSuccess}
      onSaveComplete={handleSaveComplete}
      onBack={handleBack}
      buildMcpUrl={buildMcpUrl}
      listToolNames={listToolNames}
      authActions={authActions}
      oauthCallbackPath={ROUTES.ToolsetSignIn}
      onNotifySuccess={notifySuccess}
      onNotifyError={notifyError}
      bucket={bucket}
      FileManagerModal={DialFileManagerModal}
      resolveIconUrl={resolveCatalogIconUrl}
      allowedMimeTypes={AVATAR_ALLOWED_MIME_TYPES}
      maxFileSizeBytes={AVATAR_MAX_FILE_SIZE_BYTES}
      availableLocaleOptions={localeOptions}
      labels={labels}
    />
  );
};

export default memo(ToolsetEditorPage);
